const { body, param, query, validationResult } = require('express-validator');
const ApiResponse = require('../utils/apiResponse');

/**
 * Middleware to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return ApiResponse.badRequest(res, 'Validation failed', errors.array());
  }
  next();
};

// ─── Auth Validation ──────────────────────────────────────────────────────

const signupValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/\d/)
    .withMessage('Password must contain at least one number')
    .matches(/[a-zA-Z]/)
    .withMessage('Password must contain at least one letter'),
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[\d\s-()]{7,20}$/)
    .withMessage('Please provide a valid phone number'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location cannot exceed 200 characters'),
  handleValidationErrors,
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
];

// ─── Profile Validation ───────────────────────────────────────────────────

const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .trim()
    .matches(/^\+?[\d\s-()]{7,20}$/)
    .withMessage('Please provide a valid phone number'),
  body('location')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Location cannot exceed 200 characters'),
  // Health profile fields
  body('healthProfile.asthmaPatient')
    .optional()
    .isBoolean()
    .withMessage('asthmaPatient must be a boolean'),
  body('healthProfile.ageGroup')
    .optional()
    .isIn(['child', 'teen', 'adult', 'senior'])
    .withMessage('Invalid age group'),
  body('healthProfile.respiratoryConditions')
    .optional()
    .isArray()
    .withMessage('respiratoryConditions must be an array'),
  body('healthProfile.outdoorWorker')
    .optional()
    .isBoolean()
    .withMessage('outdoorWorker must be a boolean'),
  body('healthProfile.sensitivityLevel')
    .optional()
    .isIn(['low', 'moderate', 'high', 'very_high'])
    .withMessage('Invalid sensitivity level'),
  handleValidationErrors,
];

// ─── Alert Validation ─────────────────────────────────────────────────────

const createAlertValidation = [
  body('condition')
    .isIn([
      'AQI>100', 'AQI>150', 'AQI>200', 'AQI>300',
      'PM25>35', 'PM25>55', 'PM25>150',
      'PM10>150', 'O3>0.07', 'NO2>0.05',
      'SO2>0.075', 'CO>9',
    ])
    .withMessage('Invalid alert condition'),
  body('location')
    .trim()
    .notEmpty()
    .withMessage('Location is required'),
  body('lat')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('lon')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('frequency')
    .optional()
    .isIn(['realtime', 'hourly', 'daily'])
    .withMessage('Invalid frequency'),
  body('channel')
    .optional()
    .isIn(['email', 'push', 'sms'])
    .withMessage('Invalid notification channel'),
  handleValidationErrors,
];

const updateAlertValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid alert ID'),
  body('condition')
    .optional()
    .isIn([
      'AQI>100', 'AQI>150', 'AQI>200', 'AQI>300',
      'PM25>35', 'PM25>55', 'PM25>150',
      'PM10>150', 'O3>0.07', 'NO2>0.05',
      'SO2>0.075', 'CO>9',
    ])
    .withMessage('Invalid alert condition'),
  body('location')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Location cannot be empty'),
  body('frequency')
    .optional()
    .isIn(['realtime', 'hourly', 'daily'])
    .withMessage('Invalid frequency'),
  body('channel')
    .optional()
    .isIn(['email', 'push', 'sms'])
    .withMessage('Invalid notification channel'),
  body('active')
    .optional()
    .isBoolean()
    .withMessage('active must be a boolean'),
  handleValidationErrors,
];

// ─── Location Validation ──────────────────────────────────────────────────

const saveLocationValidation = [
  body('lat')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude must be between -90 and 90'),
  body('lon')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude must be between -180 and 180'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Location name must be between 1 and 200 characters'),
  body('isPrimary')
    .optional()
    .isBoolean()
    .withMessage('isPrimary must be a boolean'),
  handleValidationErrors,
];

const locationIdValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid location ID'),
  handleValidationErrors,
];

// ─── Forecast Validation ──────────────────────────────────────────────────

const forecastValidation = [
  param('city')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('City name is required'),
  handleValidationErrors,
];

const historicalValidation = [
  param('city')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('City name is required'),
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365'),
  handleValidationErrors,
];

// ─── Admin Validation ─────────────────────────────────────────────────────

const suspendUserValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid user ID'),
  body('suspended')
    .isBoolean()
    .withMessage('suspended must be a boolean'),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  signupValidation,
  loginValidation,
  updateProfileValidation,
  createAlertValidation,
  updateAlertValidation,
  saveLocationValidation,
  locationIdValidation,
  forecastValidation,
  historicalValidation,
  suspendUserValidation,
};
