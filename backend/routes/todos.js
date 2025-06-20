const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { getRabbitChannel } = require('../config/rabbitmq');
const { keycloakAuth } = require('../middleware/auth');
const { todoSchema } = require('../middleware/validation');

// Get todos
router.get('/', keycloakAuth, async (req, res) => {
  try {
    const userId = req.user.dbUserId;
    const isAdmin = req.user.isAdmin;

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

// Create todo
router.post('/', keycloakAuth, async (req, res) => {
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
    const rabbitChannel = getRabbitChannel();
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

// Update todo
router.put('/:id', keycloakAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, completed, priority, due_date } = req.body;
    const userId = req.user.dbUserId;
    const isAdmin = req.user.isAdmin;

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

// Delete todo
router.delete('/:id', keycloakAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.dbUserId;
    const isAdmin = req.user.isAdmin;

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

module.exports = router;