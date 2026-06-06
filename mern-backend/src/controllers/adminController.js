const User = require('../models/User');
const HealthProfile = require('../models/HealthProfile');
const AlertSubscription = require('../models/AlertSubscription');
const SavedLocation = require('../models/SavedLocation');
const Notification = require('../models/Notification');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const { validatePagination } = require('../utils/validators');

/**
 * GET /api/admin/users
 * Get all users (paginated, with optional search)
 */
const getUsers = async (req, res, next) => {
  try {
    const { page: pageQuery, limit: limitQuery, search, role } = req.query;
    const { page, limit } = validatePagination(pageQuery, limitQuery);

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (role) {
      filter.role = role;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash -refreshTokens')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, users, page, limit, total, 'Users retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/stats
 * Get system-wide statistics
 */
const getSystemStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      adminUsers,
      totalAlerts,
      activeAlerts,
      totalLocations,
      totalNotifications,
      unreadNotifications,
      healthProfiles,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isSuspended: false }),
      User.countDocuments({ isSuspended: true }),
      User.countDocuments({ role: 'admin' }),
      AlertSubscription.countDocuments(),
      AlertSubscription.countDocuments({ active: true }),
      SavedLocation.countDocuments(),
      Notification.countDocuments(),
      Notification.countDocuments({ read: false }),
      HealthProfile.countDocuments(),
    ]);

    // Recent signups (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSignups = await User.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    // Most popular alert conditions
    const popularConditions = await AlertSubscription.aggregate([
      { $group: { _id: '$condition', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // Most monitored locations
    const popularLocations = await AlertSubscription.aggregate([
      { $group: { _id: '$location', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    return ApiResponse.success(res, {
      users: {
        total: totalUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        admins: adminUsers,
        recentSignups,
      },
      alerts: {
        total: totalAlerts,
        active: activeAlerts,
      },
      locations: {
        total: totalLocations,
      },
      notifications: {
        total: totalNotifications,
        unread: unreadNotifications,
      },
      healthProfiles,
      popularConditions,
      popularLocations,
    }, 'System stats retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/users/:id/stats
 * Get statistics for a specific user
 */
const getUserStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select('-passwordHash -refreshTokens');
    if (!user) {
      return ApiResponse.notFound(res, 'User not found');
    }

    const [healthProfile, alertCount, activeAlerts, savedLocations, notifications, unreadNotifications] =
      await Promise.all([
        HealthProfile.findOne({ userId: id }).lean(),
        AlertSubscription.countDocuments({ userId: id }),
        AlertSubscription.countDocuments({ userId: id, active: true }),
        SavedLocation.find({ userId: id }).lean(),
        Notification.countDocuments({ userId: id }),
        Notification.countDocuments({ userId: id, read: false }),
      ]);

    return ApiResponse.success(res, {
      user,
      healthProfile,
      alerts: {
        total: alertCount,
        active: activeAlerts,
      },
      savedLocations,
      notifications: {
        total: notifications,
        unread: unreadNotifications,
      },
    }, 'User stats retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/users/:id/suspend
 * Suspend or unsuspend a user
 */
const suspendUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { suspended } = req.body;

    // Prevent self-suspension
    if (id === req.user._id.toString()) {
      return ApiResponse.badRequest(res, 'Cannot suspend your own account');
    }

    const user = await User.findById(id);
    if (!user) {
      return ApiResponse.notFound(res, 'User not found');
    }

    // Prevent suspending other admins
    if (user.role === 'admin') {
      return ApiResponse.forbidden(res, 'Cannot suspend admin accounts');
    }

    user.isSuspended = suspended;
    await user.save();

    // If suspending, deactivate all their alerts
    if (suspended) {
      await AlertSubscription.updateMany({ userId: id }, { $set: { active: false } });
    }

    logger.info(
      `[Admin] User ${suspended ? 'suspended' : 'unsuspended'}: ${id} by ${req.user._id}`
    );

    return ApiResponse.success(
      res,
      { id: user._id, name: user.name, email: user.email, isSuspended: user.isSuspended },
      `User ${suspended ? 'suspended' : 'unsuspended'} successfully`
    );
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, getSystemStats, getUserStats, suspendUser };
