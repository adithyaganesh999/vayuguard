const AlertSubscription = require('../models/AlertSubscription');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const { validatePagination } = require('../utils/validators');

/**
 * POST /api/alerts
 * Create a new alert subscription
 */
const createAlert = async (req, res, next) => {
  try {
    const { condition, location, lat, lon, frequency, channel } = req.body;

    // Limit alerts per user
    const existingCount = await AlertSubscription.countDocuments({
      userId: req.user._id,
      active: true,
    });
    if (existingCount >= 20) {
      return ApiResponse.badRequest(res, 'Maximum of 20 active alerts allowed');
    }

    const alert = await AlertSubscription.create({
      userId: req.user._id,
      condition,
      location,
      lat,
      lon,
      frequency: frequency || 'hourly',
      channel: channel || 'email',
    });

    logger.info(`[Alert] Created: ${alert._id} for user ${req.user._id}`);

    return ApiResponse.created(res, alert, 'Alert subscription created');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/alerts
 * Get all alerts for the current user
 */
const getAlerts = async (req, res, next) => {
  try {
    const { page: pageQuery, limit: limitQuery, active } = req.query;
    const { page, limit } = validatePagination(pageQuery, limitQuery);

    const filter = { userId: req.user._id };
    if (active !== undefined) {
      filter.active = active === 'true';
    }

    const [alerts, total] = await Promise.all([
      AlertSubscription.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AlertSubscription.countDocuments(filter),
    ]);

    return ApiResponse.paginated(res, alerts, page, limit, total, 'Alerts retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/alerts/:id
 * Update an alert subscription
 */
const updateAlert = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = {};

    // Only allow specific fields to be updated
    const allowedFields = ['condition', 'location', 'lat', 'lon', 'frequency', 'channel', 'active'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const alert = await AlertSubscription.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!alert) {
      return ApiResponse.notFound(res, 'Alert not found');
    }

    logger.info(`[Alert] Updated: ${alert._id}`);

    return ApiResponse.success(res, alert, 'Alert updated');
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/alerts/:id
 * Delete an alert subscription
 */
const deleteAlert = async (req, res, next) => {
  try {
    const { id } = req.params;

    const alert = await AlertSubscription.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!alert) {
      return ApiResponse.notFound(res, 'Alert not found');
    }

    logger.info(`[Alert] Deleted: ${id}`);

    return ApiResponse.success(res, null, 'Alert deleted');
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/alerts/check-thresholds
 * Manually trigger threshold checking (admin/debug)
 */
const checkThresholds = async (req, res, next) => {
  try {
    const { checkThresholds: runCheck } = require('../services/alertScheduler');
    await runCheck();

    return ApiResponse.success(res, null, 'Threshold check completed');
  } catch (error) {
    next(error);
  }
};

module.exports = { createAlert, getAlerts, updateAlert, deleteAlert, checkThresholds };
