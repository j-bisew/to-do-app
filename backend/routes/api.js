const jwt = require("jsonwebtoken");
const Joi = require('joi');
const bcrypt = require('bcryptjs');

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
        queue: rabbitChannel ? 'connected' : 'disconnected'
      }
    });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

// Legacy auth endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { error } = userSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { username, email, password } = req.body;
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username]);
    if (existingUser.rows.length > 0) return res.status(409).json({ error: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, username: user.username }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
    res.status(201).json({ message: 'User created successfully', user, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await pool.query('SELECT id, username, email, password_hash, role FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = result.rows[0];
    if (user.password_hash === 'keycloak-managed') {
      return res.status(401).json({ error: 'This account is managed by Keycloak' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
    res.json({ message: 'Login successful', user: { id: user.id, username: user.username, email: user.email, role: user.role }, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Keycloak endpoints
app.get('/api/auth/profile', keycloakAuth, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE keycloak_id = $1', [req.user.keycloakId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userResult.rows[0];
    res.json({ id: user.id, username: user.username, email: user.email, role: user.role, keycloakRoles: req.user.roles });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Todos endpoints - try Keycloak first, fallback to legacy
const hybridAuth = async (req, res, next) => {
  try {
    await keycloakAuth(req, res, next);
  } catch (error) {
    try {
      await legacyAuth(req, res, next);
    } catch (legacyError) {
      return res.status(403).json({ error: 'Invalid token' });
    }
  }
};

app.get('/api/todos', hybridAuth, async (req, res) => {
  try {
    const userId = req.user.dbUserId || req.user.userId;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    let query, params;
    if (isAdmin) {
      query = 'SELECT t.*, u.username as owner_username FROM todos t LEFT JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC';
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

app.post('/api/todos', hybridAuth, async (req, res) => {
  try {
    const { error } = todoSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { title, description, priority, due_date } = req.body;
    const userId = req.user.dbUserId || req.user.userId;
    
    const result = await pool.query(
      'INSERT INTO todos (title, description, priority, due_date, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description || '', priority || 'medium', due_date, userId]
    );

    // Send notification
    if (rabbitChannel) {
      try {
        rabbitChannel.sendToQueue('notifications', Buffer.from(JSON.stringify({
          type: 'todo_created',
          userId: userId,
          todoId: result.rows[0].id,
          title: result.rows[0].title,
          timestamp: new Date().toISOString()
        })), { persistent: true });
      } catch (queueError) {
        console.warn('Queue error:', queueError);
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/todos/:id', hybridAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completed, priority, due_date } = req.body;
    const userId = req.user.dbUserId || req.user.userId;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

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

app.delete('/api/todos/:id', hybridAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.dbUserId || req.user.userId;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

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

// Admin endpoints (tylko dla adminów)
app.get('/api/admin/users', keycloakAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM admin_user_stats ORDER BY user_created_at DESC');
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
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM todos) as total_todos,
        (SELECT COUNT(*) FROM todos WHERE completed = true) as completed_todos,
        (SELECT COUNT(*) FROM todos WHERE completed = false) as pending_todos
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
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, username, email, role',
      [role, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'User role updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});