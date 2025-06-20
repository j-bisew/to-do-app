const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { keycloakAuth, requireAdmin } = require('../middleware/auth');
const keycloakAdmin = require('../services/keycloakAdmin');

// Get all users (admin only)
router.get('/users', keycloakAuth, requireAdmin, async (req, res) => {
  try {
    console.log('📋 Fetching users from Keycloak...');
    
    // Get users from Keycloak
    const keycloakUsers = await keycloakAdmin.getAllUsers();
    
    // Get todo counts from database
    const todoStats = await pool.query(`
      SELECT 
        u.keycloak_id,
        COUNT(t.id) as total_todos,
        COUNT(CASE WHEN t.completed = true THEN 1 END) as completed_todos,
        COUNT(CASE WHEN t.completed = false THEN 1 END) as pending_todos
      FROM users u
      LEFT JOIN todos t ON u.id = t.user_id
      WHERE u.keycloak_id IS NOT NULL
      GROUP BY u.keycloak_id
    `);
    
    // Merge data
    const usersWithStats = keycloakUsers.map(kcUser => {
      const stats = todoStats.rows.find(s => s.keycloak_id === kcUser.id) || {
        total_todos: 0,
        completed_todos: 0,
        pending_todos: 0
      };
      
      return {
        id: kcUser.id,
        username: kcUser.username,
        email: kcUser.email,
        firstName: kcUser.firstName,
        lastName: kcUser.lastName,
        enabled: kcUser.enabled,
        created_at: new Date(kcUser.createdTimestamp),
        roles: kcUser.roles || [],
        role: kcUser.roles?.includes('admin') ? 'admin' : 'user',
        total_todos: parseInt(stats.total_todos) || 0,
        completed_todos: parseInt(stats.completed_todos) || 0,
        pending_todos: parseInt(stats.pending_todos) || 0,
        source: 'keycloak'
      };
    });
    
    console.log(`✅ Found ${usersWithStats.length} Keycloak users`);
    res.json(usersWithStats);
  } catch (error) {
    console.error('❌ Error fetching users:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch users from Keycloak',
      message: error.message
    });
  }
});

// Get admin stats
router.get('/stats', keycloakAuth, requireAdmin, async (req, res) => {
  try {
    const [dbStats, keycloakUsers] = await Promise.all([
      pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM todos) as total_todos,
          (SELECT COUNT(*) FROM todos WHERE completed = true) as completed_todos,
          (SELECT COUNT(*) FROM todos WHERE completed = false) as pending_todos,
          (SELECT COUNT(*) FROM todos WHERE created_at > CURRENT_DATE - INTERVAL '7 days') as new_todos_week
      `),
      keycloakAdmin.getAllUsers()
    ]);

    const stats = dbStats.rows[0];
    const totalUsers = keycloakUsers.length;
    const adminUsers = keycloakUsers.filter(u => u.roles?.includes('admin')).length;
    const newUsersWeek = keycloakUsers.filter(u => 
      new Date(u.createdTimestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    res.json({
      total_users: totalUsers,
      admin_users: adminUsers,
      regular_users: totalUsers - adminUsers,
      total_todos: parseInt(stats.total_todos) || 0,
      completed_todos: parseInt(stats.completed_todos) || 0,
      pending_todos: parseInt(stats.pending_todos) || 0,
      new_users_week: newUsersWeek,
      new_todos_week: parseInt(stats.new_todos_week) || 0,
      data_source: 'keycloak'
    });
  } catch (error) {
    console.error('❌ Error fetching admin stats:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      message: error.message
    });
  }
});

// Update user role - now syncs with Keycloak
router.put('/users/:id/role', keycloakAuth, requireAdmin, async (req, res) => {
  try {
    const { id: keycloakId } = req.params;
    const { role } = req.body;
    
    console.log(`🔄 Admin ${req.user.username} updating user ${keycloakId} role to '${role}'`);
    
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "user" or "admin"' });
    }

    // Update role in Keycloak
    await keycloakAdmin.updateUserRole(keycloakId, role);
    
    // Update role in local database for users that exist
    await pool.query(
      'UPDATE users SET role = $1, updated_at = CURRENT_TIMESTAMP WHERE keycloak_id = $2',
      [role, keycloakId]
    );

    // Get updated user info
    const user = await keycloakAdmin.getUserById(keycloakId);
    const userRoles = await keycloakAdmin.getUserRoles(keycloakId);
    
    console.log(`✅ User ${user.username} role updated to '${role}' in both Keycloak and database`);
    
    res.json({ 
      message: `User role updated successfully to '${role}'`,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: role,
        roles: userRoles.map(r => r.name),
        updated: true
      }
    });
  } catch (error) {
    console.error('❌ Error updating user role:', error.message);
    res.status(500).json({ 
      error: 'Failed to update user role',
      message: error.message,
      details: 'Make sure Keycloak admin credentials are configured correctly'
    });
  }
});

// Initialize Keycloak roles
router.post('/init-roles', keycloakAuth, requireAdmin, async (req, res) => {
  try {
    console.log(`🔧 Admin ${req.user.username} initializing Keycloak roles...`);
    
    await keycloakAdmin.ensureRolesExist();
    
    res.json({ 
      message: 'Keycloak roles initialized successfully',
      roles: ['user', 'admin'],
      status: 'success'
    });
  } catch (error) {
    console.error('❌ Error initializing roles:', error.message);
    res.status(500).json({ 
      error: 'Failed to initialize Keycloak roles',
      message: error.message
    });
  }
});

// Get user details
router.get('/users/:id', keycloakAuth, requireAdmin, async (req, res) => {
  try {
    const { id: keycloakId } = req.params;
    
    const [user, roles, dbUser] = await Promise.all([
      keycloakAdmin.getUserById(keycloakId),
      keycloakAdmin.getUserRoles(keycloakId),
      pool.query('SELECT * FROM users WHERE keycloak_id = $1', [keycloakId])
    ]);

    const todoStats = await pool.query(`
      SELECT 
        COUNT(*) as total_todos,
        COUNT(CASE WHEN completed = true THEN 1 END) as completed_todos,
        COUNT(CASE WHEN completed = false THEN 1 END) as pending_todos
      FROM todos t
      INNER JOIN users u ON t.user_id = u.id
      WHERE u.keycloak_id = $1
    `, [keycloakId]);

    const stats = todoStats.rows[0] || { total_todos: 0, completed_todos: 0, pending_todos: 0 };

    res.json({
      keycloak: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        enabled: user.enabled,
        createdTimestamp: user.createdTimestamp
      },
      roles: roles.map(r => r.name),
      database: dbUser.rows[0] || null,
      stats: {
        total_todos: parseInt(stats.total_todos) || 0,
        completed_todos: parseInt(stats.completed_todos) || 0,
        pending_todos: parseInt(stats.pending_todos) || 0
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user details:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch user details',
      message: error.message
    });
  }
});

module.exports = router;