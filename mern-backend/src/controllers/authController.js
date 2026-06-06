const jwt = require('jsonwebtoken');
const User = require('../models/User');
const HealthProfile = require('../models/HealthProfile');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const { JWT_SECRET, JWT_EXPIRY, JWT_REFRESH_SECRET, JWT_REFRESH_EXPIRY } = require('../config/jwt');

/**
 * Generate JWT access token
 */
function generateAccessToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Generate JWT refresh token
 */
function generateRefreshToken(user) {
  return jwt.sign(
    { id: user._id },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY }
  );
}

/**
 * POST /api/auth/signup
 * Register a new user
 */
const signup = async (req, res, next) => {
  try {
    const { name, email, password, phone, location } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return ApiResponse.conflict(res, 'An account with this email already exists');
    }

    // Create user (password will be hashed by pre-save hook)
    const user = await User.create({
      name,
      email,
      passwordHash: password,
      phone,
      location,
    });

    // Create default health profile
    await HealthProfile.create({ userId: user._id });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token
    user.refreshTokens.push(refreshToken);
    await user.save();

    logger.info(`[Auth] User signed up: ${user.email}`);

    return ApiResponse.created(res, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tokens: {
        access: accessToken,
        refresh: refreshToken,
      },
    }, 'Account created successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user with password
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      return ApiResponse.unauthorized(res, 'Invalid email or password');
    }

    // Check if suspended
    if (user.isSuspended) {
      return ApiResponse.forbidden(res, 'Account has been suspended');
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return ApiResponse.unauthorized(res, 'Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Save refresh token and update last login
    user.refreshTokens.push(refreshToken);
    user.lastLogin = new Date();

    // Limit stored refresh tokens to 5 per user
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    await user.save();

    logger.info(`[Auth] User logged in: ${user.email}`);

    return ApiResponse.success(res, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        location: user.location,
      },
      tokens: {
        access: accessToken,
        refresh: refreshToken,
      },
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Invalidate the current refresh token
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user?.id;

    if (userId && refreshToken) {
      // Remove the specific refresh token
      await User.findByIdAndUpdate(userId, {
        $pull: { refreshTokens: refreshToken },
      });
    } else if (userId) {
      // Remove all refresh tokens (logout from all devices)
      await User.findByIdAndUpdate(userId, {
        $set: { refreshTokens: [] },
      });
    }

    logger.info(`[Auth] User logged out: ${userId || 'unknown'}`);
    return ApiResponse.success(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
const me = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash -refreshTokens');
    if (!user) {
      return ApiResponse.notFound(res, 'User not found');
    }

    // Also fetch health profile
    const healthProfile = await HealthProfile.findOne({ userId: user._id });

    return ApiResponse.success(res, {
      user,
      healthProfile,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return ApiResponse.unauthorized(res, 'Refresh token is required');
    }

    // Verify refresh token
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);

    // Find user and check token exists
    const user = await User.findById(decoded.id);
    if (!user || !user.refreshTokens.includes(token)) {
      return ApiResponse.unauthorized(res, 'Invalid refresh token');
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Replace old refresh token with new one
    user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
    user.refreshTokens.push(newRefreshToken);
    await user.save();

    return ApiResponse.success(res, {
      tokens: {
        access: newAccessToken,
        refresh: newRefreshToken,
      },
    }, 'Token refreshed successfully');
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return ApiResponse.unauthorized(res, 'Invalid or expired refresh token');
    }
    next(error);
  }
};

module.exports = { signup, login, logout, me, refreshToken };
