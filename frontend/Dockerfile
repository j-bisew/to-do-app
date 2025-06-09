# Simple Dockerfile for React frontend
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Remove lock file and install dependencies
RUN rm -f package-lock.json && npm install

# Copy source code
COPY . .

# Set environment variables
ENV REACT_APP_API_URL=http://localhost:5000
ENV NODE_ENV=development

# Expose port
EXPOSE 3000

ENV BROWSER=none
ENV CI=true

# Start development server
CMD ["npm", "start"]