#!/bin/bash

# Multi-platform build script for Todo App microservices
set -e

# Configuration
REGISTRY="localhost:5000"
VERSION=${1:-latest}
SERVICES=("frontend" "backend" "notification-service")

echo "🏗️  Building Todo App Microservices"
echo "Version: ${VERSION}"
echo "Registry: ${REGISTRY}"
echo ""

# Check if docker buildx is available
if ! docker buildx version > /dev/null 2>&1; then
    echo "❌ Docker Buildx is required for multi-platform builds"
    echo "Please install Docker Buildx or use Docker Desktop"
    exit 1
fi

# Create a new builder instance if it doesn't exist
if ! docker buildx inspect multiarch-builder > /dev/null 2>&1; then
    echo "📦 Creating multi-architecture builder..."
    docker buildx create --name multiarch-builder --driver docker-container --bootstrap
fi

# Use the multi-arch builder
docker buildx use multiarch-builder

# Function to build and push image
build_service() {
    local service=$1
    local context_dir=$2
    local image_name="${REGISTRY}/todo-${service}:${VERSION}"
    
    echo "🔨 Building ${service}..."
    
    # Build for multiple platforms
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --tag "${image_name}" \
        --tag "${REGISTRY}/todo-${service}:latest" \
        --push \
        "${context_dir}"
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully built ${service}"
    else
        echo "❌ Failed to build ${service}"
        exit 1
    fi
}

# Build each service
for service in "${SERVICES[@]}"; do
    if [ -d "./${service}" ]; then
        build_service "${service}" "./${service}"
    else
        echo "⚠️  Directory ./${service} not found, skipping..."
    fi
done

echo ""
echo "🎉 All services built successfully!"
echo ""
echo "📋 Built images:"
for service in "${SERVICES[@]}"; do
    echo "  ${REGISTRY}/todo-${service}:${VERSION}"
done

echo ""
echo "🚀 To deploy: docker-compose up -d"
echo "🔍 To verify: docker buildx imagetools inspect ${REGISTRY}/todo-frontend:${VERSION}"