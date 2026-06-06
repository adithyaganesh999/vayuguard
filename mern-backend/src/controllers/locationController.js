const SavedLocation = require('../models/SavedLocation');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * POST /api/locations
 * Save a new location
 */
const saveLocation = async (req, res, next) => {
  try {
    const { lat, lon, name, isPrimary } = req.body;

    // Limit saved locations per user
    const existingCount = await SavedLocation.countDocuments({ userId: req.user._id });
    if (existingCount >= 10) {
      return ApiResponse.badRequest(res, 'Maximum of 10 saved locations allowed');
    }

    // If setting as primary, unset any existing primary
    if (isPrimary) {
      await SavedLocation.updateMany(
        { userId: req.user._id, isPrimary: true },
        { $set: { isPrimary: false } }
      );
    }

    const location = await SavedLocation.create({
      userId: req.user._id,
      lat,
      lon,
      name,
      isPrimary: isPrimary || existingCount === 0, // First location is primary by default
    });

    logger.info(`[Location] Saved: ${location._id} for user ${req.user._id}`);

    return ApiResponse.created(res, location, 'Location saved');
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/locations
 * Get all saved locations for the current user
 */
const getSavedLocations = async (req, res, next) => {
  try {
    const locations = await SavedLocation.find({ userId: req.user._id })
      .sort({ isPrimary: -1, createdAt: -1 })
      .lean();

    return ApiResponse.success(res, locations, 'Saved locations retrieved');
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/locations/:id
 * Remove a saved location
 */
const removeLocation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const location = await SavedLocation.findOneAndDelete({
      _id: id,
      userId: req.user._id,
    });

    if (!location) {
      return ApiResponse.notFound(res, 'Location not found');
    }

    // If removed location was primary, set another as primary
    if (location.isPrimary) {
      const oldest = await SavedLocation.findOne({ userId: req.user._id }).sort({ createdAt: 1 });
      if (oldest) {
        oldest.isPrimary = true;
        await oldest.save();
      }
    }

    logger.info(`[Location] Removed: ${id}`);

    return ApiResponse.success(res, null, 'Location removed');
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/locations/:id/primary
 * Set a location as primary
 */
const setPrimary = async (req, res, next) => {
  try {
    const { id } = req.params;

    const location = await SavedLocation.findOne({
      _id: id,
      userId: req.user._id,
    });

    if (!location) {
      return ApiResponse.notFound(res, 'Location not found');
    }

    // Unset existing primary
    await SavedLocation.updateMany(
      { userId: req.user._id, isPrimary: true },
      { $set: { isPrimary: false } }
    );

    // Set new primary
    location.isPrimary = true;
    await location.save();

    logger.info(`[Location] Set primary: ${id}`);

    return ApiResponse.success(res, location, 'Primary location updated');
  } catch (error) {
    next(error);
  }
};

module.exports = { saveLocation, getSavedLocations, removeLocation, setPrimary };
