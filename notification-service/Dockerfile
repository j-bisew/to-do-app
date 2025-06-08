# Multi-stage build for Notification Service
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Remove package-lock.json to avoid version conflicts
RUN rm -f package-lock.json

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy package files
COPY package*.json ./

# Remove package-lock.json to avoid version conflicts
RUN rm -f package-lock.json

# Install only production dependencies
RUN npm install --only=production && npm cache clean --force

# Copy application files
COPY --from=builder --chown=nodejs:nodejs /app .

# Build arguments
ARG NODE_ENV=production

# Environment variables
ENV NODE_ENV=$NODE_ENV
ENV NODE_OPTIONS="--max-old-space-size=512"

# Change ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the service
CMD ["node", "index.js"]