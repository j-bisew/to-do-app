const { jwtVerify } = require('jose');
const { JWKS } = require('../config/keycloak');
const pool = require('../config/database');

// User sync with database
const syncUser = async (keycloakUser) => {
  try {
    // Check if user exists by keycloak_id
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE keycloak_id = $1',
      [keycloakUser.keycloakId]
    );

    if (existingUser.rows.length > 0) {
      keycloakUser.dbUserId = existingUser.rows[0].id;
      console.log('👤 Found existing user');
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
    
    keycloakUser.dbUserId = userResult.rows[0].id;
    console.log('🆕 Created new user:', keycloakUser.username, 'with ID:', keycloakUser.dbUserId);
    
  } catch (error) {
    console.error('❌ User sync error:', error.message);
    throw new Error('Failed to sync user with database');
  }
};

// Keycloak auth middleware
const keycloakAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Access token required',
      message: 'Please login through Keycloak'
    });
  }

  try {
    const token = authHeader.substring(7);
    console.log('🔍 Verifying Keycloak token...');
    
    // Verify JWT using Keycloak's public key
    const { payload } = await jwtVerify(token, JWKS);
    
    console.log('✅ Token verified, user:', payload.preferred_username);

    req.user = {
      id: payload.sub,
      username: payload.preferred_username,
      email: payload.email,
      firstName: payload.given_name,
      lastName: payload.family_name,
      roles: payload.realm_access?.roles || [],
      keycloakId: payload.sub,
      isAdmin: payload.realm_access?.roles?.includes('admin') || false
    };

    // Sync with database
    await syncUser(req.user);
    console.log('✅ User synced, dbUserId:', req.user.dbUserId);
    next();
  } catch (error) {
    console.error('❌ Keycloak auth failed:', error.message);
    return res.status(403).json({ 
      error: 'Invalid or expired token',
      message: 'Please login again through Keycloak'
    });
  }
};

// Admin role check
const requireAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ 
      error: 'Admin role required',
      message: 'You need admin privileges to access this resource'
    });
  }
  next();
};

module.exports = { keycloakAuth, requireAdmin };