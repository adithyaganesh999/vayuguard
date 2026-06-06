const express = require('express');
const router = express.Router();
const { saveLocationValidation, locationIdValidation } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const { saveLocation, getSavedLocations, removeLocation, setPrimary } = require('../controllers/locationController');

/**
 * @route   GET /api/locations
 * @desc    Get all saved locations for the current user
 * @access  Private
 */
router.get('/', authenticate, getSavedLocations);

/**
 * @route   POST /api/locations
 * @desc    Save a new location
 * @access  Private
 */
router.post('/', authenticate, saveLocationValidation, saveLocation);

/**
 * @route   DELETE /api/locations/:id
 * @desc    Remove a saved location
 * @access  Private
 */
router.delete('/:id', authenticate, locationIdValidation, removeLocation);

/**
 * @route   PUT /api/locations/:id/primary
 * @desc    Set a location as primary
 * @access  Private
 */
router.put('/:id/primary', authenticate, locationIdValidation, setPrimary);

module.exports = router;
