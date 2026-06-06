const jwt = require('jsonwebtoken');
const ApiResponse = require('../utils/apiResponse');
const { JWT_SECRET } = require('../config/jwt');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Verify JWT token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ApiResponse.unauthorized(res, 'No token provided. Please log in.');
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id).select('-passwordHash -refreshTokens');
    if (!user) {
      return ApiResponse.unauthorized(res, 'User no longer exists.');
    }

    // Check if suspended
    if (user.isSuspended) {
      return ApiResponse.forbidden(res, 'Account has been suspended.');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return ApiResponse.unauthorized(res, 'Invalid token. Please log in again.');
    }
    if (error.name === 'TokenExpiredError') {
      return ApiResponse.unauthorized(res, 'Token expired. Please log in again.');
    }
    logger.error('Auth middleware error:', error);
    return ApiResponse.error(res, 'Authentication failed');
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id).select('-passwordHash -refreshTokens');
      if (user && !user.isSuspended) {
        req.user = user;
      }
    }
  } catch {
    // Silently continue without authentication
  }
  next();
};

/**
 * Admin-only authorization
 */
const authorizeAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return ApiResponse.forbidden(res, 'Admin access required.');
  }
  next();
};

module.exports = { authenticate, optionalAuth, authorizeAdmin };
