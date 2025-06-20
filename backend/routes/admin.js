const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { keycloakAuth, requireAdmin } = require('../middleware/auth');

// Get all users (admin only)
router.get('/users', keycloakAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.username, u.email, u.role, u.created_at, u.keycloak_id,
        COUNT(t.id) as total_todos,
        COUNT(CASE WHEN t.completed = true THEN 1 END) as completed_todos,
        COUNT(CASE WHEN t.completed = false THEN 1 END) as pending_todos
      FROM users u
      LEFT JOIN todos t ON u.id = t.user_id
      WHERE u.password_hash = 'keycloak-managed'
      GROUP BY u.id, u.username, u.email, u.role, u.created_at, u.keycloak_id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get admin stats
router.get('/stats', keycloakAuth, requireAdmin, async (req, res) => {
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

// Update user role
router.put('/users/:id/role', keycloakAuth, requireAdmin, async (req, res) => {
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

module.exports = router;