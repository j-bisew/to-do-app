const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const redis = require('redis');
const amqp = require('amqplib');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

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

// Redis connection (with error handling)
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379
  },
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.warn('Redis connection refused, continuing without cache');
      return undefined; // Don't retry
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

// Handle Redis errors
redisClient.on('error', (err) => {
  console.warn('Redis Client Error:', err.message);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

redisClient.on('disconnect', () => {
  console.warn('Disconnected from Redis, continuing without cache');
});

// RabbitMQ connection
let rabbitChannel;
const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(
      `amqp://${process.env.RABBITMQ_USER || 'admin'}:${process.env.RABBITMQ_PASSWORD || 'adminpass123'}@${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}`
    );
    rabbitChannel = await connection.createChannel();
    await rabbitChannel.assertQueue('notifications', { durable: true });
    console.log('Connected to RabbitMQ');
  } catch (error) {
    console.error('RabbitMQ connection error:', error);
  }
};

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://todoapp.local',
    'http://todoapp.local:3000'
  ],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Validation schemas
const todoSchema = Joi.object({
  title: Joi.string().required().min(1).max(255),
  description: Joi.string().allow('').max(1000),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  due_date: Joi.date().optional()
});

const userSchema = Joi.object({
  username: Joi.string().required().min(3).max(50),
  email: Joi.string().email().required(),
  password: Joi.string().required().min(6)
});

// Auth middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.query('SELECT 1');
    
    // Check Redis connection
    const redisStatus = redisClient.isReady ? 'connected' : 'disconnected';
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        cache: redisStatus,
        queue: rabbitChannel ? 'connected' : 'disconnected'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// User registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { error } = userSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { username, email, password } = req.body;
    
    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      user: { id: user.id, username: user.username, email: user.email },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Find user
    const result = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: { id: user.id, username: user.username, email: user.email },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all todos for user
app.get('/api/todos', authenticateToken, async (req, res) => {
  try {
    const cacheKey = `todos:user:${req.user.userId}`;
    
    // Try to get from cache first (if Redis is available)
    try {
      if (redisClient.isReady) {
        const cachedTodos = await redisClient.get(cacheKey);
        if (cachedTodos) {
          return res.json(JSON.parse(cachedTodos));
        }
      }
    } catch (cacheError) {
      console.warn('Cache read error:', cacheError.message);
    }

    const result = await pool.query(
      'SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );

    // Cache the result for 5 minutes (if Redis is available)
    try {
      if (redisClient.isReady) {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(result.rows));
      }
    } catch (cacheError) {
      console.warn('Cache write error:', cacheError.message);
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new todo
app.post('/api/todos', authenticateToken, async (req, res) => {
  try {
    const { error } = todoSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { title, description, priority, due_date } = req.body;
    
    const result = await pool.query(
      'INSERT INTO todos (title, description, priority, due_date, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description || '', priority || 'medium', due_date, req.user.userId]
    );

    const newTodo = result.rows[0];

    // Clear cache (if Redis is available)
    try {
      if (redisClient.isReady) {
        await redisClient.del(`todos:user:${req.user.userId}`);
      }
    } catch (cacheError) {
      console.warn('Cache clear error:', cacheError.message);
    }

    // Send notification
    if (rabbitChannel) {
      try {
        const notification = {
          type: 'todo_created',
          userId: req.user.userId,
          todoId: newTodo.id,
          title: newTodo.title,
          timestamp: new Date().toISOString()
        };
        
        rabbitChannel.sendToQueue(
          'notifications',
          Buffer.from(JSON.stringify(notification)),
          { persistent: true }
        );
      } catch (queueError) {
        console.warn('Queue error:', queueError);
      }
    }

    res.status(201).json(newTodo);
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update todo
app.put('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completed, priority, due_date } = req.body;

    const result = await pool.query(
      'UPDATE todos SET title = $1, description = $2, completed = $3, priority = $4, due_date = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND user_id = $7 RETURNING *',
      [title, description, completed, priority, due_date, id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    // Clear cache (if Redis is available)
    try {
      if (redisClient.isReady) {
        await redisClient.del(`todos:user:${req.user.userId}`);
      }
    } catch (cacheError) {
      console.warn('Cache clear error:', cacheError.message);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating todo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete todo
app.delete('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM todos WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    // Clear cache (if Redis is available)
    try {
      if (redisClient.isReady) {
        await redisClient.del(`todos:user:${req.user.userId}`);
      }
    } catch (cacheError) {
      console.warn('Cache clear error:', cacheError.message);
    }

    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize connections and start server
const startServer = async () => {
  try {
    // Try to connect to Redis (non-blocking)
    try {
      await redisClient.connect();
      console.log('Connected to Redis');
    } catch (redisError) {
      console.warn('Redis connection failed, continuing without cache:', redisError.message);
    }

    // Connect to RabbitMQ (non-blocking)
    try {
      await connectRabbitMQ();
    } catch (rabbitError) {
      console.warn('RabbitMQ connection failed, continuing without notifications:', rabbitError.message);
    }

    // Test database connection (required)
    await pool.query('SELECT NOW()');
    console.log('Connected to PostgreSQL');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  try {
    if (redisClient.isReady) {
      await redisClient.quit();
    }
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

startServer().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});