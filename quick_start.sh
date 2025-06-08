#!/bin/bash

# Quick start script for Todo App
# Runs services without building custom images

echo "🚀 Quick starting Todo App with pre-built images..."

# Stop any running containers
docker-compose down

# Create network if doesn't exist
docker network create todo-network 2>/dev/null || true

# Start databases first
echo "📊 Starting databases..."
docker run -d --name todo-postgres \
  --network todo-network \
  -e POSTGRES_DB=todoapp \
  -e POSTGRES_USER=todouser \
  -e POSTGRES_PASSWORD=todopass123 \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

docker run -d --name todo-redis \
  --network todo-network \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine redis-server --appendonly yes

docker run -d --name todo-rabbitmq \
  --network todo-network \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=adminpass123 \
  -p 5672:5672 -p 15672:15672 \
  -v rabbitmq_data:/var/lib/rabbitmq \
  rabbitmq:3-management-alpine

echo "⏳ Waiting for databases to start..."
sleep 15

# Initialize database
echo "🗃️ Initializing database..."
docker exec -i todo-postgres psql -U todouser -d todoapp << 'EOF'
-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create todos table  
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

-- Insert demo user
INSERT INTO users (username, email, password_hash) VALUES 
('demo', 'demo@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeGEDk/eGu2lGxMUG') 
ON CONFLICT (email) DO NOTHING;

-- Insert sample todos
INSERT INTO todos (title, description, priority, user_id) 
SELECT 'Welcome to Todo App', 'This is your first todo item!', 'medium', id 
FROM users WHERE email = 'demo@example.com' 
ON CONFLICT DO NOTHING;
EOF

# Start simple backend (Node.js container with mounted code)
echo "🔧 Starting backend..."
docker run -d --name todo-backend \
  --network todo-network \
  -e NODE_ENV=development \
  -e DB_HOST=todo-postgres \
  -e DB_PORT=5432 \
  -e DB_NAME=todoapp \
  -e DB_USER=todouser \
  -e DB_PASSWORD=todopass123 \
  -e REDIS_HOST=todo-redis \
  -e RABBITMQ_HOST=todo-rabbitmq \
  -e RABBITMQ_USER=admin \
  -e RABBITMQ_PASSWORD=adminpass123 \
  -p 5000:5000 \
  -v $(pwd)/backend:/app \
  -w /app \
  node:18-alpine sh -c "npm install && npm start"

# Start simple frontend (serve static files)
echo "🌐 Starting frontend..."
docker run -d --name todo-frontend \
  --network todo-network \
  -p 3000:3000 \
  -v $(pwd)/frontend:/app \
  -w /app \
  node:18-alpine sh -c "npm install && npm start"

echo ""
echo "✅ Todo App started!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:5000"  
echo "🐰 RabbitMQ: http://localhost:15672 (admin/adminpass123)"
echo ""
echo "👤 Demo account: demo@example.com / demo123"
echo ""
echo "🛑 To stop: docker stop todo-frontend todo-backend todo-postgres todo-redis todo-rabbitmq"