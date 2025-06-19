FROM node:18-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN rm -f package-lock.json

RUN npm install

COPY . .

FROM node:18-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY package*.json ./

RUN rm -f package-lock.json

RUN npm install --only=production && npm cache clean --force

COPY --from=builder --chown=nodejs:nodejs /app .

ARG NODE_ENV=production

ENV NODE_ENV=$NODE_ENV
ENV NODE_OPTIONS="--max-old-space-size=512"

RUN chown -R nodejs:nodejs /app

USER nodejs

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "index.js"]