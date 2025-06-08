#!/bin/bash

# Multi-platform build script for Todo App microservices
# This script builds Docker images for both amd64 and arm64 architectures

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="localhost:5000"  # Change to your registry
VERSION=${1:-latest}
SERVICES=("frontend" "backend" "notification-service")

echo -e "${BLUE}🏗️  Building Todo App Microservices${NC}"
echo -e "${BLUE}Version: ${VERSION}${NC}"
echo -e "${BLUE}Registry: ${REGISTRY}${NC}"
echo ""

# Check if docker buildx is available
if ! docker buildx version > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker Buildx is required for multi-platform builds${NC}"
    echo "Please install Docker Buildx or use Docker Desktop"
    exit 1
fi

# Create a new builder instance if it doesn't exist
if ! docker buildx inspect multiarch-builder > /dev/null 2>&1; then
    echo -e "${YELLOW}📦 Creating multi-architecture builder...${NC}"
    docker buildx create --name multiarch-builder --driver docker-container --bootstrap
fi

# Use the multi-arch builder
docker buildx use multiarch-builder

# Function to build and push image
build_service() {
    local service=$1
    local context_dir=$2
    local image_name="${REGISTRY}/todo-${service}:${VERSION}"
    
    echo -e "${YELLOW}🔨 Building ${service}...${NC}"
    
    # Build for multiple platforms
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --tag "${image_name}" \
        --tag "${REGISTRY}/todo-${service}:latest" \
        --push \
        "${context_dir}"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Successfully built ${service}${NC}"
    else
        echo -e "${RED}❌ Failed to build ${service}${NC}"
        exit 1
    fi
}

# Build each service
for service in "${SERVICES[@]}"; do
    if [ -d "./${service}" ]; then
        build_service "${service}" "./${service}"
    else
        echo -e "${YELLOW}⚠️  Directory ./${service} not found, skipping...${NC}"
    fi
done

echo ""
echo -e "${GREEN}🎉 All services built successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Built images:${NC}"
for service in "${SERVICES[@]}"; do
    echo -e "  ${REGISTRY}/todo-${service}:${VERSION}"
done

echo ""
echo -e "${BLUE}🚀 To deploy:${NC}"
echo "  docker-compose up -d"
echo ""
echo -e "${BLUE}🔍 To verify images:${NC}"
echo "  docker buildx imagetools inspect ${REGISTRY}/todo-frontend:${VERSION}"
echo ""

# Optional: Save build info
cat > build-info.json << EOF
{
  "build_time": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "version": "${VERSION}",
  "registry": "${REGISTRY}",
  "platforms": ["linux/amd64", "linux/arm64"],
  "services": $(printf '%s\n' "${SERVICES[@]}" | jq -R . | jq -s .)
}
EOF

echo -e "${GREEN}📄 Build information saved to build-info.json${NC}"