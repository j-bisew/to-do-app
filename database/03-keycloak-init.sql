-- Keycloak integration - Final permissions and cleanup only
-- (Tables and structure are already created in init.sql)

-- Connect to todoapp database
\c todoapp;

-- Only add any missing indexes that might be specific to Keycloak performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_todos_user_created ON todos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_keycloak_roles ON user_keycloak_mapping USING GIN(roles);

-- Ensure all existing users without Keycloak mapping get a fallback mapping
INSERT INTO user_keycloak_mapping (user_id, keycloak_user_id, keycloak_username, roles)
SELECT 
    u.id,
    'legacy-' || u.id::text, 
    u.username,
    CASE 
        WHEN u.role = 'admin' THEN ARRAY['admin', 'user']
        ELSE ARRAY['user']
    END
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM user_keycloak_mapping ukm WHERE ukm.user_id = u.id
);

-- Connect to keycloak database and set up permissions
\c keycloak;
GRANT ALL PRIVILEGES ON SCHEMA public TO todouser;

-- Back to todoapp for final verification
\c todoapp;

-- Final verification and logging
DO $$
BEGIN
    RAISE NOTICE 'Keycloak integration setup completed successfully';
    RAISE NOTICE 'Total users: %', (SELECT COUNT(*) FROM users);
    RAISE NOTICE 'Keycloak mappings: %', (SELECT COUNT(*) FROM user_keycloak_mapping);
    RAISE NOTICE 'Admin users: %', (SELECT string_agg(username, ', ') FROM users WHERE role = 'admin');
    RAISE NOTICE 'Database setup complete - ready for Keycloak connection';
END $$;