#!/bin/bash

set -e

echo "🏗️ Multi-Platform Build Demonstration"
echo "This shows that images can be built for multiple architectures"
echo ""

if ! docker buildx inspect multiarch-builder > /dev/null 2>&1; then
    echo "📦 Creating multi-architecture builder..."
    docker buildx create --name multiarch-builder --driver docker-container --bootstrap
fi

docker buildx use multiarch-builder

echo "🔨 Building frontend for multiple platforms (demo)..."
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag todo-frontend-multiplatform:latest \
    ./frontend

echo "Multi-platform build successful!"
echo ""
echo "This demonstrates that your Dockerfiles support:"
echo "  - linux/amd64 (Intel/AMD 64-bit)"
echo "  - linux/arm64 (ARM 64-bit)"
echo ""
echo "For actual deployment, use: docker-compose up --build -d"