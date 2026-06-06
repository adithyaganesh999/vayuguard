const rateLimit = require('express-rate-limit');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * General API rate limiter
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    return ApiResponse.tooManyRequests(res);
  },
});

/**
 * Authentication rate limiter - stricter limits
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 auth attempts per window
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    return ApiResponse.tooManyRequests(res, 'Too many login attempts. Please try again later.');
  },
});

/**
 * Forecast API rate limiter - moderate limits
 */
const forecastLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30, // 30 forecast requests per window
  message: {
    success: false,
    message: 'Too many forecast requests. Please try again after 5 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Forecast rate limit exceeded for IP: ${req.ip}`);
    return ApiResponse.tooManyRequests(res, 'Too many forecast requests. Please slow down.');
  },
});

/**
 * Admin API rate limiter
 */
const adminLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 50, // 50 admin requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Admin rate limit exceeded for IP: ${req.ip}, User: ${req.user?.id}`);
    return ApiResponse.tooManyRequests(res);
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  forecastLimiter,
  adminLimiter,
};
