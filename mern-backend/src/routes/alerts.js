const express = require('express');
const router = express.Router();
const { createAlertValidation, updateAlertValidation } = require('../middleware/validation');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { createAlert, getAlerts, updateAlert, deleteAlert, checkThresholds } = require('../controllers/alertController');

/**
 * @route   GET /api/alerts
 * @desc    Get all alerts for the current user
 * @access  Private
 */
router.get('/', authenticate, getAlerts);

/**
 * @route   POST /api/alerts
 * @desc    Create a new alert subscription
 * @access  Private
 */
router.post('/', authenticate, createAlertValidation, createAlert);

/**
 * @route   PUT /api/alerts/:id
 * @desc    Update an alert subscription
 * @access  Private
 */
router.put('/:id', authenticate, updateAlertValidation, updateAlert);

/**
 * @route   DELETE /api/alerts/:id
 * @desc    Delete an alert subscription
 * @access  Private
 */
router.delete('/:id', authenticate, deleteAlert);

/**
 * @route   POST /api/alerts/check-thresholds
 * @desc    Manually trigger threshold checking (admin only)
 * @access  Private/Admin
 */
router.post('/check-thresholds', authenticate, authorizeAdmin, checkThresholds);

module.exports = router;
