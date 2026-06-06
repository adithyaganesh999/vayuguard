const express = require('express');
const router = express.Router();
const { suspendUserValidation } = require('../middleware/validation');
const { adminLimiter } = require('../middleware/rateLimit');
const { authenticate, authorizeAdmin } = require('../middleware/auth');
const { getUsers, getSystemStats, getUserStats, suspendUser } = require('../controllers/adminController');

// All admin routes require authentication + admin role
router.use(authenticate, authorizeAdmin, adminLimiter);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (paginated, searchable)
 * @access  Private/Admin
 */
router.get('/users', getUsers);

/**
 * @route   GET /api/admin/stats
 * @desc    Get system-wide statistics
 * @access  Private/Admin
 */
router.get('/stats', getSystemStats);

/**
 * @route   GET /api/admin/users/:id/stats
 * @desc    Get statistics for a specific user
 * @access  Private/Admin
 */
router.get('/users/:id/stats', getUserStats);

/**
 * @route   PUT /api/admin/users/:id/suspend
 * @desc    Suspend or unsuspend a user
 * @access  Private/Admin
 */
router.put('/users/:id/suspend', suspendUserValidation, suspendUser);

module.exports = router;
