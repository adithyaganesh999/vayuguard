const { createClient } = require('redis');

let redisClient = null;

async function connectRedis() {
  if (!process.env.REDIS_URL) {
    console.warn('[Redis] REDIS_URL not set — caching and rate-limiting will use in-memory fallback');
    return null;
  }

  try {
    redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.on('error', (err) => console.error('[Redis] Client error:', err));
    redisClient.on('connect', () => console.log('[Redis] Connected successfully'));
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('[Redis] Connection failed:', error.message);
    return null;
  }
}

function getRedisClient() {
  return redisClient;
}

module.exports = { connectRedis, getRedisClient };
