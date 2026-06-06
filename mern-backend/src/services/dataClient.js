const axios = require('axios');
const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');

const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://localhost:8001';
const CACHE_TTL = parseInt(process.env.DATA_CACHE_TTL || '600', 10); // 10 minutes default

/**
 * Axios client for the data pipeline APIs
 */
const dataClient = axios.create({
  baseURL: DATA_SERVICE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Service': 'vayuguard-backend',
  },
});

// Request interceptor
dataClient.interceptors.request.use(
  (config) => {
    logger.info(`[Data Client] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    logger.error('[Data Client] Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
dataClient.interceptors.response.use(
  (response) => {
    logger.info(`[Data Client] Response ${response.status} from ${response.config.url}`);
    return response;
  },
  (error) => {
    if (error.response) {
      logger.error(
        `[Data Client] Error ${error.response.status} from ${error.config?.url}: ${error.response.data?.message || error.message}`
      );
    } else if (error.request) {
      logger.error(`[Data Client] No response received: ${error.message}`);
    } else {
      logger.error(`[Data Client] Request setup error: ${error.message}`);
    }
    return Promise.reject(error);
  }
);

/**
 * Get station data for a location
 */
async function getStationData(location) {
  const cacheKey = `station:${location}`;

  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`[Data Client] Cache read error: ${err.message}`);
    }
  }

  const response = await dataClient.get(`/stations/${encodeURIComponent(location)}`);
  const data = response.data;

  if (redisClient) {
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(data));
    } catch (err) {
      logger.warn(`[Data Client] Cache write error: ${err.message}`);
    }
  }

  return data;
}

/**
 * Get pollutant breakdown for a location
 */
async function getPollutantBreakdown(location) {
  const cacheKey = `pollutants:${location}`;

  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`[Data Client] Cache read error: ${err.message}`);
    }
  }

  const response = await dataClient.get(`/pollutants/${encodeURIComponent(location)}`);
  const data = response.data;

  if (redisClient) {
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL, JSON.stringify(data));
    } catch (err) {
      logger.warn(`[Data Client] Cache write error: ${err.message}`);
    }
  }

  return data;
}

/**
 * Get available cities list
 */
async function getAvailableCities() {
  const cacheKey = 'cities:available';

  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      logger.warn(`[Data Client] Cache read error: ${err.message}`);
    }
  }

  const response = await dataClient.get('/cities');
  const data = response.data;

  if (redisClient) {
    try {
      await redisClient.setEx(cacheKey, CACHE_TTL * 6, JSON.stringify(data)); // Longer TTL for cities list
    } catch (err) {
      logger.warn(`[Data Client] Cache write error: ${err.message}`);
    }
  }

  return data;
}

module.exports = { dataClient, getStationData, getPollutantBreakdown, getAvailableCities };
