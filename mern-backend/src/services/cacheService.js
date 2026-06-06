const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * In-memory cache fallback when Redis is unavailable
 */
const memoryCache = new Map();

/**
 * Get a value from cache
 */
async function get(key) {
  const redisClient = getRedisClient();

  if (redisClient) {
    try {
      const value = await redisClient.get(key);
      if (value) {
        logger.debug(`[Cache] Redis hit: ${key}`);
        return JSON.parse(value);
      }
      return null;
    } catch (error) {
      logger.warn(`[Cache] Redis get error for ${key}: ${error.message}`);
    }
  }

  // Fallback to in-memory cache
  const item = memoryCache.get(key);
  if (item) {
    if (item.expiry > Date.now()) {
      logger.debug(`[Cache] Memory hit: ${key}`);
      return item.value;
    }
    memoryCache.delete(key); // Expired
  }
  return null;
}

/**
 * Set a value in cache with TTL
 */
async function set(key, value, ttlSeconds = 300) {
  const redisClient = getRedisClient();

  if (redisClient) {
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
      logger.debug(`[Cache] Redis set: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      logger.warn(`[Cache] Redis set error for ${key}: ${error.message}`);
    }
  }

  // Fallback to in-memory cache
  memoryCache.set(key, {
    value,
    expiry: Date.now() + ttlSeconds * 1000,
  });

  // Clean up expired items periodically (simple approach)
  if (memoryCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of memoryCache.entries()) {
      if (v.expiry <= now) {
        memoryCache.delete(k);
      }
    }
  }

  return true;
}

/**
 * Delete a value from cache
 */
async function del(key) {
  const redisClient = getRedisClient();

  if (redisClient) {
    try {
      await redisClient.del(key);
      logger.debug(`[Cache] Redis delete: ${key}`);
      return true;
    } catch (error) {
      logger.warn(`[Cache] Redis delete error for ${key}: ${error.message}`);
    }
  }

  memoryCache.delete(key);
  return true;
}

/**
 * Delete all keys matching a pattern
 */
async function delPattern(pattern) {
  const redisClient = getRedisClient();

  if (redisClient) {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
        logger.debug(`[Cache] Redis delete pattern: ${pattern} (${keys.length} keys)`);
      }
      return keys.length;
    } catch (error) {
      logger.warn(`[Cache] Redis delPattern error: ${error.message}`);
    }
  }

  // For memory cache, do simple prefix match
  let count = 0;
  const prefix = pattern.replace('*', '');
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
      count++;
    }
  }
  return count;
}

/**
 * Get or set cache value (cache-aside pattern)
 */
async function getOrSet(key, fetchFn, ttlSeconds = 300) {
  const cached = await get(key);
  if (cached !== null) {
    return cached;
  }

  const value = await fetchFn();
  if (value !== null && value !== undefined) {
    await set(key, value, ttlSeconds);
  }
  return value;
}

/**
 * Flush all cache
 */
async function flush() {
  const redisClient = getRedisClient();

  if (redisClient) {
    try {
      await redisClient.flushDb();
      logger.info('[Cache] Redis flushed');
    } catch (error) {
      logger.warn(`[Cache] Redis flush error: ${error.message}`);
    }
  }

  memoryCache.clear();
  logger.info('[Cache] Memory cache cleared');
}

module.exports = { get, set, del, delPattern, getOrSet, flush };
