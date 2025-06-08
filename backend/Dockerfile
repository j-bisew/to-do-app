# Multi-stage build for Node.js backend
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Remove package-lock.json to avoid version conflicts  
RUN rm -f package-lock.json

# Install all dependencies
RUN npm install

# Copy source code
COPY . .

# Build TypeScript if applicable
# RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install curl for healthcheck
RUN apk add --no-cache curl dumb-init

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

# Copy application files from builder
COPY --from=builder --chown=nodejs:nodejs /app .

# Build arguments
ARG NODE_ENV=production
ARG API_PORT=5000

# Environment variables
ENV NODE_ENV=$NODE_ENV
ENV PORT=$API_PORT
ENV NODE_OPTIONS="--max-old-space-size=1024"

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE $API_PORT

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:$API_PORT/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "server.js"]