const { jwtVerify } = require('jose');
const jwt = require('jsonwebtoken');

const legacyAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = { ...decoded, dbUserId: decoded.userId, roles: ['user'] };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

const keycloakAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const token = authHeader.substring(7);
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${keycloakUrl}/realms/${realm}`,
      audience: clientId
    });

    req.user = {
      id: payload.sub,
      username: payload.preferred_username,
      email: payload.email,
      roles: payload.realm_access?.roles || [],
      keycloakId: payload.sub
    };

    // Sync with database
    await syncUser(req.user);
    next();
  } catch (error) {
    console.error('Keycloak auth failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const syncUser = async (keycloakUser) => {
  try {
    const mappingResult = await pool.query(
      'SELECT user_id FROM user_keycloak_mapping WHERE keycloak_user_id = $1',
      [keycloakUser.keycloakId]
    );

    if (mappingResult.rows.length > 0) {
      keycloakUser.dbUserId = mappingResult.rows[0].user_id;
    } else {
      const userResult = await pool.query(
        'INSERT INTO users (username, email, password_hash, role, keycloak_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [keycloakUser.username, keycloakUser.email, 'keycloak-managed', 
         keycloakUser.roles.includes('admin') ? 'admin' : 'user', keycloakUser.keycloakId]
      );
      
      const userId = userResult.rows[0].id;
      await pool.query(
        'INSERT INTO user_keycloak_mapping (user_id, keycloak_user_id, keycloak_username, roles) VALUES ($1, $2, $3, $4)',
        [userId, keycloakUser.keycloakId, keycloakUser.username, keycloakUser.roles]
      );
      
      keycloakUser.dbUserId = userId;
    }
  } catch (error) {
    console.error('User sync error:', error);
  }
};

module.exports = {
  legacyAuth,
  keycloakAuth,
  syncUser
};