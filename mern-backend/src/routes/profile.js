const express = require('express');
const router = express.Router();
const { updateProfileValidation } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const { getProfile, updateProfile, deleteAccount } = require('../controllers/profileController');

/**
 * @route   GET /api/profile
 * @desc    Get current user's full profile
 * @access  Private
 */
router.get('/', authenticate, getProfile);

/**
 * @route   PUT /api/profile
 * @desc    Update current user's profile
 * @access  Private
 */
router.put('/', authenticate, updateProfileValidation, updateProfile);

/**
 * @route   DELETE /api/profile
 * @desc    Delete current user's account
 * @access  Private
 */
router.delete('/', authenticate, deleteAccount);

module.exports = router;
