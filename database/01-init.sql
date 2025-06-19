-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    keycloak_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Todos table
CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    completed BOOLEAN DEFAULT FALSE,
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    due_date DATE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories table (for future expansion)
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#1976d2',
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Todo categories junction table
CREATE TABLE IF NOT EXISTS todo_categories (
    todo_id INTEGER REFERENCES todos(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (todo_id, category_id)
);

-- Keycloak integration table
CREATE TABLE IF NOT EXISTS user_keycloak_mapping (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    keycloak_user_id VARCHAR(255) UNIQUE NOT NULL,
    keycloak_username VARCHAR(255) NOT NULL,
    roles TEXT[] DEFAULT ARRAY['user'],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_keycloak_id ON users(keycloak_id);
CREATE INDEX IF NOT EXISTS idx_user_keycloak_mapping_user_id ON user_keycloak_mapping(user_id);
CREATE INDEX IF NOT EXISTS idx_user_keycloak_mapping_keycloak_id ON user_keycloak_mapping(keycloak_user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todos_updated_at 
    BEFORE UPDATE ON todos 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_keycloak_mapping_updated_at 
    BEFORE UPDATE ON user_keycloak_mapping 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional - for development)
INSERT INTO users (username, email, password_hash, role) VALUES 
('demo', 'demo@example.com', '$2a$12$ALj/ICOiI2Ma2yKobKHOUONENujsMFgi4BC3YMJryb424dbwwaACy', 'admin'), -- password: demo123
('admin', 'admin@example.com', 'keycloak-managed', 'admin') -- Keycloak managed admin
ON CONFLICT (email) DO NOTHING;

-- Get the demo user ID and create initial todos
DO $$
DECLARE
    demo_user_id INTEGER;
    admin_user_id INTEGER;
BEGIN
    SELECT id INTO demo_user_id FROM users WHERE email = 'demo@example.com';
    SELECT id INTO admin_user_id FROM users WHERE email = 'admin@example.com';
    
    IF demo_user_id IS NOT NULL THEN
        INSERT INTO todos (title, description, priority, user_id) VALUES 
        ('Welcome to Todo App', 'This is your first todo item. You can edit or delete it!', 'medium', demo_user_id),
        ('Set up your profile', 'Customize your account settings', 'low', demo_user_id),
        ('Explore features', 'Try creating, editing, and completing todos', 'high', demo_user_id)
        ON CONFLICT DO NOTHING;
        
        INSERT INTO categories (name, color, user_id) VALUES 
        ('Work', '#1976d2', demo_user_id),
        ('Personal', '#dc004e', demo_user_id),
        ('Shopping', '#388e3c', demo_user_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- Create Keycloak mappings for existing users
    IF demo_user_id IS NOT NULL THEN
        INSERT INTO user_keycloak_mapping (user_id, keycloak_user_id, keycloak_username, roles) VALUES 
        (demo_user_id, 'demo-user-id', 'demo', ARRAY['admin', 'user'])
        ON CONFLICT (keycloak_user_id) DO NOTHING;
    END IF;

    IF admin_user_id IS NOT NULL THEN
        INSERT INTO user_keycloak_mapping (user_id, keycloak_user_id, keycloak_username, roles) VALUES 
        (admin_user_id, 'admin-user-id', 'admin', ARRAY['admin', 'user'])
        ON CONFLICT (keycloak_user_id) DO NOTHING;
    END IF;
END $$;

-- Views for analytics and admin panel
CREATE OR REPLACE VIEW user_todo_stats AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(t.id) as total_todos,
    COUNT(CASE WHEN t.completed = true THEN 1 END) as completed_todos,
    COUNT(CASE WHEN t.completed = false THEN 1 END) as pending_todos,
    COUNT(CASE WHEN t.due_date < CURRENT_DATE AND t.completed = false THEN 1 END) as overdue_todos
FROM users u
LEFT JOIN todos t ON u.id = t.user_id
GROUP BY u.id, u.username;

CREATE OR REPLACE VIEW admin_user_stats AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.role,
    u.created_at as user_created_at,
    COUNT(t.id) as total_todos,
    COUNT(CASE WHEN t.completed = true THEN 1 END) as completed_todos,
    COUNT(CASE WHEN t.completed = false THEN 1 END) as pending_todos,
    COUNT(CASE WHEN t.due_date < CURRENT_DATE AND t.completed = false THEN 1 END) as overdue_todos,
    MAX(t.created_at) as last_todo_created,
    ukm.keycloak_user_id,
    ukm.roles as keycloak_roles
FROM users u
LEFT JOIN todos t ON u.id = t.user_id
LEFT JOIN user_keycloak_mapping ukm ON u.id = ukm.user_id
GROUP BY u.id, u.username, u.email, u.role, u.created_at, ukm.keycloak_user_id, ukm.roles;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO todouser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO todouser;