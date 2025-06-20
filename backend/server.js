const express = require('express');
const pool = require('./config/database');
const { initRedis } = require('./config/redis');
const { initRabbitMQ } = require('./config/rabbitmq');
const { realm } = require('./config/keycloak');
const setupMiddleware = require('./middleware');

// Import routes
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const todoRoutes = require('./routes/todos');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Setup middleware
setupMiddleware(app);

// Setup routes
app.use('/', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/admin', adminRoutes);

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
      console.log(`Todo App Backend Server running on port ${PORT}`);
      console.log(`Authentication: Keycloak SSO Only`);
      console.log(`Keycloak Realm: ${realm}`);
      console.log(`Ready for Keycloak users!`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();