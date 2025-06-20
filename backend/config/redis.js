const redis = require('redis');

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

const getRedisClient = () => redisClient;

module.exports = { initRedis, getRedisClient };