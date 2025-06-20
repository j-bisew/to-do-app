const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { getRedisClient } = require('../config/redis');
const { getRabbitChannel } = require('../config/rabbitmq');

// Health check
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    const redisClient = getRedisClient();
    const rabbitChannel = getRabbitChannel();
    
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
router.get('/api/info', (req, res) => {
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

module.exports = router;