#!/bin/bash

set -e

NAMESPACE="todoapp-clean"

echo "Deploying Todo App to Kubernetes..."
echo "Using namespace: $NAMESPACE"

echo "Step 1: Creating namespace and basic resources..."

kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

echo "Applying manifests with namespace: $NAMESPACE"
kubectl apply -f <(sed "s/namespace: todoapp/namespace: $NAMESPACE/g" kubernetes/namespace.yaml)
kubectl apply -f <(sed "s/namespace: todoapp/namespace: $NAMESPACE/g" kubernetes/secrets.yaml) 
kubectl apply -f <(sed "s/namespace: todoapp/namespace: $NAMESPACE/g" kubernetes/configmap.yaml)
kubectl apply -f <(sed "s/namespace: todoapp/namespace: $NAMESPACE/g" kubernetes/storage.yaml)

echo "Waiting for basic resources..."
sleep 5

echo "Step 2: Setting up database initialization..."
kubectl apply -f <(sed "s/namespace: todoapp/namespace: $NAMESPACE/g" kubernetes/postgres-init.yaml)

echo "Step 3: Deploying databases..."
kubectl apply -f <(sed "s/namespace: todoapp/namespace: $NAMESPACE/g" kubernetes/postgres.yaml)
kubectl apply -f <(sed "s/namespace: todoapp/namespace: $NAMESPACE/g" kubernetes/redis.yaml)
kubectl apply -f <(sed "s/namespace: todoapp/namespace: $NAMESPACE/g" kubernetes/rabbitmq.yaml)

echo "Waiting for databases to be ready..."
echo "Waiting for PostgreSQL..."
kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=180s || echo "PostgreSQL timeout - continuing..."

echo "Waiting for Redis..."
kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=120s || echo "Redis timeout - continuing..."

echo "Waiting for RabbitMQ..."
kubectl wait --for=condition=ready pod -l app=rabbitmq -n $NAMESPACE --timeout=180s || echo "RabbitMQ timeout - continuing..."

echo "Additional wait for services to initialize..."
sleep 30

echo "Step 4: Deploying applications..."
kubectl apply -f <(sed "s/namespace: todoapp/namespace: $NAMESPACE/g" kubernetes/backend.yaml)

echo "Waiting for backend to be ready..."
kubectl wait --for=condition=ready pod -l app=backend -n $NAMESPACE --timeout=120s || echo "Backend timeout - continuing..."

kubectl apply -f <(sed "s/namespace: todoapp/namespace: $NAMESPACE/g" kubernetes/notification.yaml)
kubectl apply -f <(sed "s/namespace: todoapp/namespace: $NAMESPACE/g" kubernetes/frontend.yaml)

echo "Step 5: Setting up networking and scaling..."
kubectl apply -f <(sed "s/namespace: todoapp/namespace: $NAMESPACE/g" kubernetes/ingress.yaml)
kubectl apply -f <(sed "s/namespace: todoapp/namespace: $NAMESPACE/g" kubernetes/hpa.yaml)

echo "Final wait for all pods..."
sleep 15

echo ""
echo "Deployment Status:"
kubectl get pods -n $NAMESPACE
echo ""
kubectl get svc -n $NAMESPACE
echo ""

echo "Health Checks:"
echo "Pods status:"
kubectl get pods -n $NAMESPACE --no-headers | awk '{print $1 ": " $3}'

echo ""
echo "Deployment completed!"
echo ""
echo "Access your application:"
echo "Frontend: kubectl port-forward -n $NAMESPACE svc/frontend-service 3000:3000"
echo "Backend:  kubectl port-forward -n $NAMESPACE svc/backend-service 5000:5000"
echo "RabbitMQ: kubectl port-forward -n $NAMESPACE svc/rabbitmq-service 15672:15672"
echo ""
echo "Monitor deployment:"
echo "kubectl get pods -n $NAMESPACE -w"
echo "kubectl logs -n $NAMESPACE deployment/backend -f"
echo ""
echo "To cleanup: kubectl delete namespace $NAMESPACE"
