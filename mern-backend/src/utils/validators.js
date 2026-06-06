/**
 * Custom validation helpers for VayuGuard backend.
 */

/**
 * Check if a string is a valid email
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Check if a string is a valid MongoDB ObjectId
 */
function isValidObjectId(id) {
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  return objectIdRegex.test(id);
}

/**
 * Check if coordinates are valid
 */
function isValidCoordinates(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  return (
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Check if password meets requirements
 */
function isStrongPassword(password) {
  if (!password || password.length < 6) return false;
  // At least 6 characters, contains at least one letter and one number
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
}

/**
 * Sanitize string input - trim and escape HTML
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validate AQI condition string
 */
function isValidAQICondition(condition) {
  const validConditions = [
    'AQI>100',
    'AQI>150',
    'AQI>200',
    'AQI>300',
    'PM25>35',
    'PM25>55',
    'PM25>150',
    'PM10>150',
    'O3>0.07',
    'NO2>0.05',
    'SO2>0.075',
    'CO>9',
  ];
  return validConditions.includes(condition);
}

/**
 * Parse AQI threshold from condition string
 */
function parseAQIThreshold(condition) {
  const match = condition.match(/^(?:AQI|PM25|PM10|O3|NO2|SO2|CO)>(\d+\.?\d*)$/);
  if (!match) return null;
  return parseFloat(match[1]);
}

/**
 * Validate pagination parameters
 */
function validatePagination(page, limit) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  return { page: p, limit: l };
}

module.exports = {
  isValidEmail,
  isValidObjectId,
  isValidCoordinates,
  isStrongPassword,
  sanitizeString,
  isValidAQICondition,
  parseAQIThreshold,
  validatePagination,
};
