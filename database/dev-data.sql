-- Development sample data for Todo App

-- Insert additional test users
INSERT INTO users (username, email, password_hash) VALUES 
('testuser1', 'test1@example.com', '$2a$12$ALj/ICOiI2Ma2yKobKHOUONENujsMFgi4BC3YMJryb424dbwwaACy'), -- password: demo123
('testuser2', 'test2@example.com', '$2a$12$ALj/ICOiI2Ma2yKobKHOUONENujsMFgi4BC3YMJryb424dbwwaACy'), -- password: demo123
('john.doe', 'john.doe@example.com', '$2a$12$ALj/ICOiI2Ma2yKobKHOUONENujsMFgi4BC3YMJryb424dbwwaACy') -- password: demo123
ON CONFLICT (email) DO NOTHING;

-- Get user IDs for sample data
DO $$
DECLARE
    demo_user_id INTEGER;
    test1_user_id INTEGER;
    test2_user_id INTEGER;
    john_user_id INTEGER;
BEGIN
    -- Get user IDs
    SELECT id INTO demo_user_id FROM users WHERE email = 'demo@example.com';
    SELECT id INTO test1_user_id FROM users WHERE email = 'test1@example.com';
    SELECT id INTO test2_user_id FROM users WHERE email = 'test2@example.com';
    SELECT id INTO john_user_id FROM users WHERE email = 'john.doe@example.com';
    
    -- Sample todos for demo user
    IF demo_user_id IS NOT NULL THEN
        INSERT INTO todos (title, description, completed, priority, due_date, user_id) VALUES 
        ('Complete project documentation', 'Write comprehensive README and API documentation', false, 'high', CURRENT_DATE + INTERVAL '3 days', demo_user_id),
        ('Code review for backend API', 'Review authentication and validation logic', false, 'medium', CURRENT_DATE + INTERVAL '1 day', demo_user_id),
        ('Setup CI/CD pipeline', 'Configure GitHub Actions for automated testing and deployment', false, 'medium', CURRENT_DATE + INTERVAL '5 days', demo_user_id),
        ('Buy groceries', 'Milk, bread, eggs, vegetables', false, 'low', CURRENT_DATE + INTERVAL '2 days', demo_user_id),
        ('Workout session', 'Gym workout - legs and cardio', true, 'medium', CURRENT_DATE - INTERVAL '1 day', demo_user_id),
        ('Call mom', 'Weekly family check-in call', true, 'low', CURRENT_DATE - INTERVAL '2 days', demo_user_id),
        ('Prepare presentation', 'Create slides for project demo', false, 'high', CURRENT_DATE + INTERVAL '7 days', demo_user_id),
        ('Database optimization', 'Add indexes and optimize slow queries', false, 'medium', CURRENT_DATE + INTERVAL '10 days', demo_user_id)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Sample todos for test1 user
    IF test1_user_id IS NOT NULL THEN
        INSERT INTO todos (title, description, completed, priority, due_date, user_id) VALUES 
        ('Learn Kubernetes', 'Complete online course on Kubernetes fundamentals', false, 'high', CURRENT_DATE + INTERVAL '14 days', test1_user_id),
        ('Morning jog', 'Daily exercise routine', true, 'low', CURRENT_DATE, test1_user_id),
        ('Team meeting preparation', 'Prepare agenda and status updates', false, 'medium', CURRENT_DATE + INTERVAL '1 day', test1_user_id),
        ('Clean apartment', 'Weekly cleaning routine', false, 'low', CURRENT_DATE + INTERVAL '3 days', test1_user_id)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Sample todos for test2 user
    IF test2_user_id IS NOT NULL THEN
        INSERT INTO todos (title, description, completed, priority, due_date, user_id) VALUES 
        ('Docker security audit', 'Review and update Dockerfile security practices', false, 'high', CURRENT_DATE + INTERVAL '5 days', test2_user_id),
        ('Update dependencies', 'Check for security updates in package.json', false, 'medium', CURRENT_DATE + INTERVAL '2 days', test2_user_id),
        ('Write unit tests', 'Increase test coverage for critical components', false, 'high', CURRENT_DATE + INTERVAL '6 days', test2_user_id)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Sample todos for john user  
    IF john_user_id IS NOT NULL THEN
        INSERT INTO todos (title, description, completed, priority, due_date, user_id) VALUES 
        ('Plan vacation', 'Research destinations and book flights', false, 'low', CURRENT_DATE + INTERVAL '30 days', john_user_id),
        ('Dentist appointment', 'Annual dental checkup', false, 'medium', CURRENT_DATE + INTERVAL '14 days', john_user_id),
        ('Read technical book', 'Finish "Clean Code" by Robert Martin', false, 'low', CURRENT_DATE + INTERVAL '21 days', john_user_id),
        ('Backup important files', 'Create backup of photos and documents', false, 'medium', CURRENT_DATE + INTERVAL '7 days', john_user_id)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Additional categories for demo user
    IF demo_user_id IS NOT NULL THEN
        INSERT INTO categories (name, color, user_id) VALUES 
        ('Development', '#2196f3', demo_user_id),
        ('Health', '#4caf50', demo_user_id),
        ('Learning', '#9c27b0', demo_user_id),
        ('Household', '#ff9800', demo_user_id),
        ('Finance', '#f44336', demo_user_id)
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Sample categories for other users
    IF test1_user_id IS NOT NULL THEN
        INSERT INTO categories (name, color, user_id) VALUES 
        ('Fitness', '#4caf50', test1_user_id),
        ('Career', '#2196f3', test1_user_id)
        ON CONFLICT DO NOTHING;
    END IF;
    
    IF test2_user_id IS NOT NULL THEN
        INSERT INTO categories (name, color, user_id) VALUES 
        ('Security', '#f44336', test2_user_id),
        ('Testing', '#9c27b0', test2_user_id)
        ON CONFLICT DO NOTHING;
    END IF;
    
END $$;

-- Insert some additional test data for analytics
INSERT INTO todos (title, description, completed, priority, user_id, created_at) 
SELECT 
    'Generated task ' || generate_series,
    'This is a generated task for testing purposes',
    (random() > 0.7), -- 30% chance of being completed
    (ARRAY['low', 'medium', 'high'])[floor(random() * 3 + 1)],
    (SELECT id FROM users WHERE email = 'demo@example.com'),
    CURRENT_TIMESTAMP - (random() * INTERVAL '30 days')
FROM generate_series(1, 15)
ON CONFLICT DO NOTHING;

-- Update some timestamps to simulate realistic usage
UPDATE todos 
SET updated_at = created_at + (random() * INTERVAL '5 days')
WHERE user_id = (SELECT id FROM users WHERE email = 'demo@example.com');

-- Add some overdue todos for testing
UPDATE todos 
SET due_date = CURRENT_DATE - INTERVAL '3 days'
WHERE title LIKE '%Generated task%' 
AND random() > 0.8
AND completed = false;

-- Create some todos with no due date
UPDATE todos 
SET due_date = NULL
WHERE title LIKE '%Generated task%' 
AND random() > 0.6;

ANALYZE users;
ANALYZE todos;
ANALYZE categories;