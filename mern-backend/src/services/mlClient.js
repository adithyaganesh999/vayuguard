const axios = require('axios');
const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const CACHE_TTL = parseInt(process.env.ML_CACHE_TTL || '300', 10); // 5 minutes default

/**
 * Axios client configured for the FastAPI ML service
 */
const mlClient = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'X-Service': 'vayuguard-backend',
  },
});

// Request interceptor for logging
mlClient.interceptors.request.use(
  (config) => {
    logger.info(`[ML Client] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    logger.error('[ML Client] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for logging
mlClient.interceptors.response.use(
  (response) => {
    logger.info(`[ML Client] Response ${response.status} from ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.response) {
      logger.error(
        `[ML Client] Error ${error.response.status} from ${error.config?.url}: ${error.response.data?.detail || error.message}`
      );
    } else if (error.request) {
      logger.error(`[ML Client] No response received: ${error.message}`);
    } else {
      logger.error(`[ML Client] Request setup error: ${error.message}`);
    }
    return Promise.reject(error);
  }
);

/**
 * Get AQI forecast for a city
 */
async function getForecast(city) {
  const cacheKey = `forecast:${city}`;

  // Try cache first
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info(`[ML Client] Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`[ML Client] Cache read error: ${err.message}`);
    }
  }

  // Fetch from ML service
  const response = await mlClient.get(`/forecast/${encodeURIComponent(city)}`);
  const data = response.data;

  // Store in cache
  if (redisClient) {
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(data));
    } catch (err) {
      logger.warn(`[ML Client] Cache write error: ${err.message}`);
    }
  }

  return data;
}

/**
 * Get historical data for a city
 */
async function getHistorical(city, days = 30) {
  const cacheKey = `historical:${city}:${days}`;

  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info(`[ML Client] Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`[ML Client] Cache read error: ${err.message}`);
    }
  }

  const response = await mlClient.get(
    `/historical/${encodeURIComponent(city)}?days=${days}`
  );
  const data = response.data;

  if (redisClient) {
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL * 2, JSON.stringify(data)); // Longer TTL for historical
    } catch (err) {
      logger.warn(`[ML Client] Cache write error: ${err.message}`);
    }
  }

  return data;
}

/**
 * Get current AQI for a location
 */
async function getCurrentAQI(lat, lon) {
  const cacheKey = `aqi:current:${lat}:${lon}`;
  const shortTTL = 60; // 1 minute for current data

  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`[ML Client] Cache read error: ${err.message}`);
    }
  }

  const response = await mlClient.get(`/aqi/current?lat=${lat}&lon=${lon}`);
  const data = response.data;

  if (redisClient) {
    try {
      await redisClient.setEx(cacheKey, shortTTL, JSON.stringify(data));
    } catch (err) {
      logger.warn(`[ML Client] Cache write error: ${err.message}`);
    }
  }

  return data;
}

module.exports = { mlClient, getForecast, getHistorical, getCurrentAQI };
