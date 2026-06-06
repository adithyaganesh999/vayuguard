const express = require('express');
const router = express.Router();
const { forecastValidation, historicalValidation } = require('../middleware/validation');
const { forecastLimiter } = require('../middleware/rateLimit');
const { optionalAuth, authenticate } = require('../middleware/auth');
const { getCityForecast, getCityHistorical } = require('../controllers/forecastController');

// Rate limiting for forecast routes
router.use(forecastLimiter);

/**
 * @route   GET /api/forecast/:city
 * @desc    Get AQI forecast for a city
 * @access  Public (optional auth for personalized results)
 */
router.get('/:city', optionalAuth, forecastValidation, getCityForecast);

/**
 * @route   GET /api/forecast/historical/:city
 * @desc    Get historical AQI data for a city
 * @access  Private
 */
router.get('/historical/:city', authenticate, historicalValidation, getCityHistorical);

module.exports = router;
