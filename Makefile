# Todo App Makefile
# Provides common development and deployment commands

.PHONY: help build up down logs clean test lint build-multi health

# Default target
help: ## Show this help message
	@echo "Todo App - Available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development commands
install: ## Install dependencies for all services
	@echo "📦 Installing dependencies..."
	cd frontend && npm install
	cd backend && npm install
	cd notification-service && npm install

dev: ## Start development environment with hot reload
	@echo "🚀 Starting development environment..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

build: ## Build all Docker images
	@echo "🏗️  Building Docker images..."
	docker-compose build

up: ## Start all services
	@echo "🚀 Starting all services..."
	docker-compose up -d

down: ## Stop all services
	@echo "🛑 Stopping all services..."
	docker-compose down

restart: down up ## Restart all services

logs: ## Show logs from all services
	docker-compose logs -f

logs-backend: ## Show backend service logs
	docker-compose logs -f backend

logs-frontend: ## Show frontend service logs
	docker-compose logs -f frontend

logs-db: ## Show database logs
	docker-compose logs -f postgres

# Multi-platform build
build-multi: ## Build multi-platform images (amd64, arm64)
	@echo "🏗️  Building multi-platform images..."
	chmod +x build.sh
	./build.sh

# Health checks
health: ## Check health of all services
	@echo "🔍 Checking service health..."
	@echo "Frontend: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "DOWN")"
	@echo "Backend: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health || echo "DOWN")"
	@echo "PostgreSQL: $$(docker-compose exec -T postgres pg_isready -U todouser -d todoapp | grep -o 'accepting connections' || echo "DOWN")"
	@echo "Redis: $$(docker-compose exec -T redis redis-cli ping || echo "DOWN")"
	@echo "RabbitMQ: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:15672 || echo "DOWN")"

# Database commands
db-migrate: ## Run database migrations
	@echo "🗃️  Running database migrations..."
	docker-compose exec backend npm run migrate

db-seed: ## Seed database with sample data
	@echo "🌱 Seeding database..."
	docker-compose exec postgres psql -U todouser -d todoapp -f /docker-entrypoint-initdb.d/init.sql

db-reset: ## Reset database (WARNING: This will delete all data)
	@echo "⚠️  Resetting database..."
	@read -p "Are you sure? This will delete ALL data (y/N): " confirm && [ "$$confirm" = "y" ]
	docker-compose down -v
	docker-compose up -d postgres
	sleep 5
	$(MAKE) db-migrate
	$(MAKE) db-seed

# Testing
test: ## Run tests for all services
	@echo "🧪 Running tests..."
	cd backend && npm test
	cd frontend && npm test -- --coverage --watchAll=false

test-backend: ## Run backend tests
	cd backend && npm test

test-frontend: ## Run frontend tests
	cd frontend && npm test -- --coverage --watchAll=false

# Code quality
lint: ## Run linting for all services
	@echo "🔍 Running linters..."
	cd backend && npm run lint
	cd frontend && npm run lint

lint-fix: ## Fix linting issues
	@echo "🔧 Fixing linting issues..."
	cd backend && npm run lint -- --fix
	cd frontend && npm run lint:fix

# Security
security-scan: ## Run security scan on dependencies
	@echo "🔒 Running security scan..."
	cd backend && npm audit
	cd frontend && npm audit

security-fix: ## Fix security vulnerabilities
	@echo "🔧 Fixing security vulnerabilities..."
	cd backend && npm audit fix
	cd frontend && npm audit fix

# Cleanup
clean: ## Clean up containers, images, and volumes
	@echo "🧹 Cleaning up..."
	docker-compose down -v --remove-orphans
	docker system prune -f
	docker volume prune -f

clean-all: ## Clean everything including images
	@echo "🧹 Cleaning everything..."
	docker-compose down -v --remove-orphans --rmi all
	docker system prune -af
	docker volume prune -f

# Production
prod-build: ## Build production images
	@echo "🏭 Building production images..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

prod-up: ## Start production environment
	@echo "🚀 Starting production environment..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-down: ## Stop production environment
	@echo "🛑 Stopping production environment..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Monitoring
stats: ## Show container resource usage
	@echo "📊 Container resource usage:"
	docker stats --no-stream

ps: ## Show running containers
	@echo "📋 Running containers:"
	docker-compose ps

# Backup and restore
backup: ## Backup database
	@echo "💾 Creating database backup..."
	mkdir -p backups
	docker-compose exec postgres pg_dump -U todouser -d todoapp > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup created in backups/ directory"

restore: ## Restore database from backup (specify BACKUP_FILE=filename)
	@echo "📥 Restoring database from backup..."
	@if [ -z "$(BACKUP_FILE)" ]; then echo "Please specify BACKUP_FILE=filename"; exit 1; fi
	docker-compose exec -T postgres psql -U todouser -d todoapp < $(BACKUP_FILE)
	@echo "✅ Database restored"

# Quick setup for new developers
setup: ## Initial setup for new developers
	@echo "🎯 Setting up Todo App for development..."
	@echo "1. Installing dependencies..."
	$(MAKE) install
	@echo "2. Building Docker images..."
	$(MAKE) build
	@echo "3. Starting services..."
	$(MAKE) up
	@echo "4. Waiting for services to be ready..."
	sleep 30
	@echo "5. Checking health..."
	$(MAKE) health
	@echo ""
	@echo "🎉 Setup complete!"
	@echo "Frontend: http://localhost:3000"
	@echo "Backend API: http://localhost:5000"
	@echo "RabbitMQ Management: http://localhost:15672 (admin/adminpass123)"
	@echo ""
	@echo "Try logging in with demo@example.com / demo123"

# Documentation
docs: ## Generate API documentation
	@echo "📚 Generating documentation..."
	@echo "API documentation would be generated here"
	@echo "Frontend: Open http://localhost:3000 in your browser"
	@echo "Backend API: http://localhost:5000/health"