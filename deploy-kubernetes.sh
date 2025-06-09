#!/bin/bash

set -e

echo "🚀 Deploying Todo App to Kubernetes..."

# Step 1: Basic resources
echo "📦 Step 1: Creating namespace and basic resources..."
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/secrets.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/storage.yaml

echo "⏳ Waiting for basic resources..."
sleep 5

# Step 2: Database initialization scripts
echo "🗃️ Step 2: Setting up database initialization..."
kubectl apply -f kubernetes/postgres-init.yaml

# Step 3: Databases and infrastructure
echo "🛢️ Step 3: Deploying databases..."
kubectl apply -f kubernetes/postgres.yaml
kubectl apply -f kubernetes/redis.yaml
kubectl apply -f kubernetes/rabbitmq.yaml

echo "⏳ Waiting for databases to be ready..."
echo "Waiting for PostgreSQL..."
kubectl wait --for=condition=ready pod -l app=postgres -n todoapp --timeout=180s || echo "PostgreSQL timeout - continuing..."

echo "Waiting for Redis..."
kubectl wait --for=condition=ready pod -l app=redis -n todoapp --timeout=120s || echo "Redis timeout - continuing..."

echo "Waiting for RabbitMQ..."
kubectl wait --for=condition=ready pod -l app=rabbitmq -n todoapp --timeout=180s || echo "RabbitMQ timeout - continuing..."

# Additional wait for services to be fully ready
echo "⏳ Additional wait for services to initialize..."
sleep 30

# Step 4: Applications
echo "🖥️ Step 4: Deploying applications..."
kubectl apply -f kubernetes/backend.yaml

echo "⏳ Waiting for backend to be ready..."
kubectl wait --for=condition=ready pod -l app=backend -n todoapp --timeout=120s || echo "Backend timeout - continuing..."

kubectl apply -f kubernetes/notification.yaml
kubectl apply -f kubernetes/frontend.yaml

# Step 5: Network and scaling
echo "🌐 Step 5: Setting up networking and scaling..."
kubectl apply -f kubernetes/ingress.yaml
kubectl apply -f kubernetes/hpa.yaml

echo "⏳ Final wait for all pods..."
sleep 15

# Show status
echo ""
echo "📊 Deployment Status:"
kubectl get pods -n todoapp
echo ""
kubectl get svc -n todoapp
echo ""

# Check if everything is running
echo "🔍 Health Checks:"
echo "Pods status:"
kubectl get pods -n todoapp --no-headers | awk '{print $1 ": " $3}'

echo ""
echo "✅ Deployment completed!"
echo ""
echo "🌐 Access your application:"
echo "Frontend: kubectl port-forward -n todoapp svc/frontend-service 3000:3000"
echo "Backend:  kubectl port-forward -n todoapp svc/backend-service 5000:5000"
echo "RabbitMQ: kubectl port-forward -n todoapp svc/rabbitmq-service 15672:15672"
echo ""
echo "📊 Monitor deployment:"
echo "kubectl get pods -n todoapp -w"
echo "kubectl logs -n todoapp deployment/backend -f"