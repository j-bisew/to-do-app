const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { keycloakAuth } = require('../middleware/auth');

// User profile endpoint
router.get('/profile', keycloakAuth, async (req, res) => {
  try {
    const userResult = await pool.query(
      'SELECT * FROM users WHERE keycloak_id = $1',
      [req.user.keycloakId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    const user = userResult.rows[0];
    res.json({
      id: user.id,
      keycloakId: req.user.keycloakId,
      username: user.username,
      email: user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      role: user.role,
      keycloakRoles: req.user.roles,
      isAdmin: req.user.isAdmin,
      createdAt: user.created_at,
      isKeycloakManaged: true
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;