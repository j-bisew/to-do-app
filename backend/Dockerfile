FROM node:18-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN rm -f package-lock.json

RUN npm install

COPY . .

FROM node:18-alpine AS production

RUN apk add --no-cache curl dumb-init

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY package*.json ./

RUN rm -f package-lock.json

RUN npm install --only=production && npm cache clean --force

COPY --from=builder --chown=nodejs:nodejs /app .

ARG NODE_ENV=production
ARG API_PORT=5000

ENV NODE_ENV=$NODE_ENV
ENV PORT=$API_PORT
ENV NODE_OPTIONS="--max-old-space-size=1024"

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE $API_PORT

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:$API_PORT/health || exit 1

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "server.js"]
