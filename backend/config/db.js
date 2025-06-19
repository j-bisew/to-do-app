const { Pool } = require('pg');
const redis = require('redis');
const amqp = require('amqplib');
const { createRemoteJWKSet } = require('jose');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'todoapp',
  user: process.env.DB_USER || 'todouser',
  password: process.env.DB_PASSWORD || 'todopass123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis setup
let redisClient;
const initRedis = async () => {
  try {
    redisClient = redis.createClient({
      socket: { host: process.env.REDIS_HOST || 'redis', port: process.env.REDIS_PORT || 6379 }
    });
    redisClient.on('error', (err) => console.warn('Redis error:', err.message));
    await redisClient.connect();
    console.log('✅ Connected to Redis');
  } catch (error) {
    console.warn('⚠️ Redis failed:', error.message);
    redisClient = null;
  }
};

// RabbitMQ setup
let rabbitChannel;
const initRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(
      `amqp://${process.env.RABBITMQ_USER || 'admin'}:${process.env.RABBITMQ_PASSWORD || 'adminpass123'}@${process.env.RABBITMQ_HOST || 'localhost'}:${process.env.RABBITMQ_PORT || 5672}`
    );
    rabbitChannel = await connection.createChannel();
    await rabbitChannel.assertQueue('notifications', { durable: true });
    console.log('✅ Connected to RabbitMQ');
  } catch (error) {
    console.warn('⚠️ RabbitMQ failed:', error.message);
  }
};

// Keycloak setup
const keycloakUrl = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const realm = process.env.KEYCLOAK_REALM || 'todo-realm';
const clientId = process.env.KEYCLOAK_CLIENT_ID || 'todo-backend';
const jwksUri = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`;
const JWKS = createRemoteJWKSet(new URL(jwksUri));

module.exports = {
    pool,
    initRedis,
    redisClient,
    initRabbitMQ,
    rabbitChannel,
    keycloakUrl,
    realm,
    clientId,
    jwksUri,
    JWKS
};