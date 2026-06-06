const User = require('../models/User');
const HealthProfile = require('../models/HealthProfile');
const SavedLocation = require('../models/SavedLocation');
const AlertSubscription = require('../models/AlertSubscription');
const Notification = require('../models/Notification');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const cacheService = require('../services/cacheService');

/**
 * GET /api/profile
 * Get current user's profile (personal + health)
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash -refreshTokens');
    if (!user) {
      return ApiResponse.notFound(res, 'User not found');
    }

    const healthProfile = await HealthProfile.findOne({ userId: user._id });
    const savedLocations = await SavedLocation.find({ userId: user._id });
    const alertCount = await AlertSubscription.countDocuments({ userId: user._id, active: true });
    const unreadNotifications = await Notification.countDocuments({ userId: user._id, read: false });

    return ApiResponse.success(res, {
      user,
      healthProfile,
      savedLocations,
      stats: {
        activeAlerts: alertCount,
        unreadNotifications,
        savedLocations: savedLocations.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/profile
 * Update current user's profile (personal + health)
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, location, healthProfile: healthData } = req.body;

    // Update user personal info
    const userUpdates = {};
    if (name !== undefined) userUpdates.name = name;
    if (phone !== undefined) userUpdates.phone = phone;
    if (location !== undefined) userUpdates.location = location;

    let updatedUser = req.user;
    if (Object.keys(userUpdates).length > 0) {
      updatedUser = await User.findByIdAndUpdate(req.user._id, userUpdates, {
        new: true,
        runValidators: true,
      }).select('-passwordHash -refreshTokens');
    }

    // Update health profile
    let healthProfile = null;
    if (healthData) {
      healthProfile = await HealthProfile.findOneAndUpdate(
        { userId: req.user._id },
        { $set: healthData },
        { new: true, upsert: true, runValidators: true }
      );
    } else {
      healthProfile = await HealthProfile.findOne({ userId: req.user._id });
    }

    // Invalidate user cache
    await cacheService.del(`user:${req.user._id}:profile`);

    logger.info(`[Profile] Updated for user: ${req.user._id}`);

    return ApiResponse.success(res, {
      user: updatedUser,
      healthProfile,
    }, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/profile
 * Delete current user's account and all associated data
 */
const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Delete all associated data
    await Promise.all([
      HealthProfile.deleteOne({ userId }),
      SavedLocation.deleteMany({ userId }),
      AlertSubscription.deleteMany({ userId }),
      Notification.deleteMany({ userId }),
    ]);

    // Delete user
    await User.findByIdAndDelete(userId);

    // Invalidate caches
    await cacheService.delPattern(`user:${userId}:*`);

    logger.info(`[Profile] Account deleted: ${userId}`);

    return ApiResponse.success(res, null, 'Account deleted successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, deleteAccount };
