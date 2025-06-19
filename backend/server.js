const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const redis = require('redis');
const amqp = require('amqplib');
const Joi = require('joi');
const { jwtVerify, createRemoteJWKSet } = require('jose');

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'todoapp',
  user: process.env.DB_USER || 'todouser',
  password: process.env.DB_PASSWORD || 'todopass123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis setup
let redisClient;
const initRedis = async () => {
  try {
    redisClient = redis.createClient({
      socket: { host: process.env.REDIS_HOST || 'redis', port: process.env.REDIS_PORT || 6379 }
    });
    redisClient.on('error', (err) => console.warn('Redis error:', err.message));
    await redisClient.connect();
    console.log('✅ Connected to Redis');
  } catch (error) {
    console.warn('⚠️ Redis failed:', error.message);
    redisClient = null;
  }
};

// RabbitMQ setup
let rabbitChannel;
const initRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(
      `amqp://${process.env.RABBITMQ_USER || 'admin'}:${process.env.RABBITMQ_PASSWORD || 'adminpass123'}@${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}`
    );
    rabbitChannel = await connection.createChannel();
    await rabbitChannel.assertQueue('notifications', { durable: true });
    console.log('✅ Connected to RabbitMQ');
  } catch (error) {
    console.warn('⚠️ RabbitMQ failed:', error.message);
  }
};

// Keycloak setup
const realm = process.env.KEYCLOAK_REALM || 'todo-realm';
const jwksUri = `http://keycloak:8080/realms/${realm}/protocol/openid-connect/certs`;
const JWKS = createRemoteJWKSet(new URL(jwksUri));

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));

// Validation schemas
const todoSchema = Joi.object({
  title: Joi.string().required().min(1).max(255),
  description: Joi.string().allow('').max(1000),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  due_date: Joi.date().optional()
});

// Keycloak auth middleware
const keycloakAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const token = authHeader.substring(7);
    console.log('🔍 Verifying token...');
    
    // Verify JWT using Keycloak's public key
    const { payload } = await jwtVerify(token, JWKS);
    
    console.log('✅ Token verified, user:', payload.preferred_username);

    req.user = {
      id: payload.sub,
      username: payload.preferred_username,
      email: payload.email,
      roles: payload.realm_access?.roles || [],
      keycloakId: payload.sub
    };

    // Sync with database
    await syncUser(req.user);
    console.log('✅ User synced, dbUserId:', req.user.dbUserId);
    next();
  } catch (error) {
    console.error('❌ Keycloak auth failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// User sync with database
const syncUser = async (keycloakUser) => {
  try {
    // Check if mapping exists
    const mappingResult = await pool.query(
      'SELECT user_id FROM user_keycloak_mapping WHERE keycloak_user_id = $1',
      [keycloakUser.keycloakId]
    );

    if (mappingResult.rows.length > 0) {
      keycloakUser.dbUserId = mappingResult.rows[0].user_id;
      console.log('👤 Found existing user mapping');
      return;
    }

    // Create new user
    const userResult = await pool.query(
      'INSERT INTO users (username, email, password_hash, role, keycloak_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [
        keycloakUser.username, 
        keycloakUser.email, 
        'keycloak-managed', 
        keycloakUser.roles.includes('admin') ? 'admin' : 'user',
        keycloakUser.keycloakId
      ]
    );
    
    const userId = userResult.rows[0].id;
    
    // Create mapping
    await pool.query(
      'INSERT INTO user_keycloak_mapping (user_id, keycloak_user_id, keycloak_username, roles) VALUES ($1, $2, $3, $4)',
      [userId, keycloakUser.keycloakId, keycloakUser.username, keycloakUser.roles]
    );
    
    keycloakUser.dbUserId = userId;
    console.log('🆕 Created new user:', keycloakUser.username, 'with ID:', userId);
    
  } catch (error) {
    console.error('❌ User sync error:', error.message);
    
    // Fallback: try to find existing user by email
    try {
      const fallbackUser = await pool.query('SELECT id FROM users WHERE email = $1', [keycloakUser.email]);
      if (fallbackUser.rows.length > 0) {
        keycloakUser.dbUserId = fallbackUser.rows[0].id;
        console.log('🔄 Fallback: Found user by email');
        
        // Create missing mapping
        await pool.query(
          'INSERT INTO user_keycloak_mapping (user_id, keycloak_user_id, keycloak_username, roles) VALUES ($1, $2, $3, $4) ON CONFLICT (keycloak_user_id) DO NOTHING',
          [keycloakUser.dbUserId, keycloakUser.keycloakId, keycloakUser.username, keycloakUser.roles]
        );
      }
    } catch (fallbackError) {
      console.error('❌ Fallback sync failed:', fallbackError.message);
    }
  }
};

// Admin role check
const requireAdmin = (req, res, next) => {
  if (!req.user.roles.includes('admin')) {
    return res.status(403).json({ error: 'Admin role required' });
  }
  next();
};

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        cache: redisClient ? 'connected' : 'disconnected',
        queue: rabbitChannel ? 'connected' : 'disconnected',
        auth: 'keycloak-only'
      }
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// API Info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Todo App API',
    version: '2.0.0',
    description: 'Microservices Todo Application with Keycloak SSO',
    authentication: 'Keycloak OAuth2/OIDC only',
    features: [
      'Single Sign-On with Keycloak',
      'Role-based Authorization (user, admin)',
      'Admin Panel',
      'Real-time Notifications',
      'Redis Caching',
      'PKCE Support'
    ]
  });
});

// User profile endpoint
app.get('/api/auth/profile', keycloakAuth, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT u.*, ukm.roles as keycloak_roles FROM users u LEFT JOIN user_keycloak_mapping ukm ON u.keycloak_id = $1 WHERE u.keycloak_id = $1',
      [req.user.keycloakId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    const user = userResult.rows[0];
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      keycloakRoles: req.user.roles,
      createdAt: user.created_at,
      isKeycloakManaged: true
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Todos endpoints
app.get('/api/todos', keycloakAuth, async (req, res) => {
  try {
    const userId = req.user.dbUserId;
    const isAdmin = req.user.roles.includes('admin');

    let query, params;
    if (isAdmin) {
      query = `
        SELECT t.*, u.username as owner_username, u.email as owner_email 
        FROM todos t 
        LEFT JOIN users u ON t.user_id = u.id 
        ORDER BY t.created_at DESC
      `;
      params = [];
    } else {
      query = 'SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at DESC';
      params = [userId];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/todos', keycloakAuth, async (req, res) => {
  try {
    const { error } = todoSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { title, description, priority, due_date } = req.body;
    const userId = req.user.dbUserId;
    
    console.log('📝 Creating todo for user:', userId, 'title:', title);
    
    const result = await pool.query(
      'INSERT INTO todos (title, description, priority, due_date, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description || '', priority || 'medium', due_date, userId]
    );

    console.log('✅ Todo created:', result.rows[0].id);

    // Send notification
    if (rabbitChannel) {
      try {
        rabbitChannel.sendToQueue('notifications', Buffer.from(JSON.stringify({
          type: 'todo_created',
          userId: userId,
          todoId: result.rows[0].id,
          title: result.rows[0].title,
          username: req.user.username,
          timestamp: new Date().toISOString()
        })), { persistent: true });
      } catch (queueError) {
        console.warn('Queue error:', queueError);
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error creating todo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/todos/:id', keycloakAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completed, priority, due_date } = req.body;
    const userId = req.user.dbUserId;
    const isAdmin = req.user.roles.includes('admin');

    let query, params;
    if (isAdmin) {
      query = 'UPDATE todos SET title = $1, description = $2, completed = $3, priority = $4, due_date = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *';
      params = [title, description, completed, priority, due_date, id];
    } else {
      query = 'UPDATE todos SET title = $1, description = $2, completed = $3, priority = $4, due_date = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND user_id = $7 RETURNING *';
      params = [title, description, completed, priority, due_date, id, userId];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' });

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating todo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/todos/:id', keycloakAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.dbUserId;
    const isAdmin = req.user.roles.includes('admin');

    let query, params;
    if (isAdmin) {
      query = 'DELETE FROM todos WHERE id = $1 RETURNING *';
      params = [id];
    } else {
      query = 'DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING *';
      params = [id, userId];
    }

    const result = await pool.query(query, params);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Todo not found' });

    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin endpoints
app.get('/api/admin/users', keycloakAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.username, u.email, u.role, u.created_at,
        COUNT(t.id) as total_todos,
        COUNT(CASE WHEN t.completed = true THEN 1 END) as completed_todos,
        COUNT(CASE WHEN t.completed = false THEN 1 END) as pending_todos
      FROM users u
      LEFT JOIN todos t ON u.id = t.user_id
      WHERE u.password_hash = 'keycloak-managed'
      GROUP BY u.id, u.username, u.email, u.role, u.created_at
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/stats', keycloakAuth, requireAdmin, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE password_hash = 'keycloak-managed') as total_users,
        (SELECT COUNT(*) FROM todos) as total_todos,
        (SELECT COUNT(*) FROM todos WHERE completed = true) as completed_todos,
        (SELECT COUNT(*) FROM todos WHERE completed = false) as pending_todos,
        (SELECT COUNT(*) FROM users WHERE password_hash = 'keycloak-managed' AND created_at > CURRENT_DATE - INTERVAL '7 days') as new_users_week,
        (SELECT COUNT(*) FROM todos WHERE created_at > CURRENT_DATE - INTERVAL '7 days') as new_todos_week
    `);
    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/admin/users/:id/role', keycloakAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const result = await pool.query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND password_hash = $3 RETURNING id, username, email, role',
      [role, id, 'keycloak-managed']
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'User role updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: 'This API requires Keycloak authentication',
    authRequired: true
  });
});

// Start server
const startServer = async () => {
  try {
    await initRedis();
    await initRabbitMQ();
    
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Todo App Backend Server running on port ${PORT}`);
      console.log(`🔐 Authentication: Keycloak SSO Only`);
      console.log(`📍 Keycloak Realm: ${realm}`);
      console.log(`🎯 Ready for Keycloak users!`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();