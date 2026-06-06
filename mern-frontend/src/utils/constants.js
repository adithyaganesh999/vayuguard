// Constants for VayuGuard - AQI thresholds, API endpoints, etc.

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  LOGOUT: '/auth/logout',
  PROFILE: '/auth/profile',
  CHANGE_PASSWORD: '/auth/change-password',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',

  // AQI
  CURRENT_AQI: '/aqi/current',
  HISTORICAL_AQI: '/aqi/historical',
  FORECAST: '/aqi/forecast',

  // Alerts
  ALERTS: '/alerts',
  ALERT_BY_ID: (id) => `/alerts/${id}`,
  ALERT_HISTORY: '/alerts/history',
  ALERT_TEST: (id) => `/alerts/${id}/test`,

  // Health
  HEALTH_RISK: '/health/risk',
  HEALTH_PROFILE: '/profile/health',

  // Profile
  SAVED_LOCATIONS: '/profile/locations',
  LOCATION_BY_ID: (id) => `/profile/locations/${id}`,
  NOTIFICATION_PREFS: '/profile/notifications',
};

// AQI Thresholds
export const AQI_THRESHOLDS = {
  GOOD: { min: 0, max: 50, label: 'Good' },
  MODERATE: { min: 51, max: 100, label: 'Moderate' },
  UNHEALTHY_SENSITIVE: { min: 101, max: 150, label: 'Unhealthy for Sensitive Groups' },
  UNHEALTHY: { min: 151, max: 200, label: 'Unhealthy' },
  VERY_UNHEALTHY: { min: 201, max: 300, label: 'Very Unhealthy' },
  HAZARDOUS: { min: 301, max: 500, label: 'Hazardous' },
};

// Pollutant thresholds (WHO guidelines)
export const POLLUTANT_LIMITS = {
  pm25: { who: 15, national: 60, unit: 'µg/m³', label: 'PM2.5' },
  pm10: { who: 45, national: 150, unit: 'µg/m³', label: 'PM10' },
  no2: { who: 25, national: 100, unit: 'ppb', label: 'NO₂' },
  o3: { who: 60, national: 70, unit: 'ppb', label: 'O₃' },
  so2: { who: 40, national: 75, unit: 'ppb', label: 'SO₂' },
  co: { who: 4, national: 9, unit: 'ppm', label: 'CO' },
};

// Default alert thresholds
export const DEFAULT_ALERT_THRESHOLDS = {
  low: 50,
  moderate: 100,
  high: 150,
  veryHigh: 200,
  severe: 300,
};

// Cache durations (in milliseconds)
export const CACHE_DURATIONS = {
  AQI_CURRENT: 5 * 60 * 1000,       // 5 minutes
  AQI_FORECAST: 15 * 60 * 1000,     // 15 minutes
  AQI_HISTORICAL: 60 * 60 * 1000,   // 1 hour
  USER_PROFILE: 30 * 60 * 1000,     // 30 minutes
  LOCATIONS: 24 * 60 * 60 * 1000,   // 24 hours
};

// Supported cities
export const SUPPORTED_CITIES = [
  'Bangalore', 'Delhi', 'Mumbai', 'Chennai', 'Kolkata',
  'Hyderabad', 'Pune', 'Jaipur', 'Lucknow', 'Ahmedabad',
  'Chandigarh', 'Bhopal',
];

// Pollutant display names
export const POLLUTANT_NAMES = {
  pm25: 'PM2.5',
  pm10: 'PM10',
  no2: 'NO₂',
  o3: 'O₃',
  so2: 'SO₂',
  co: 'CO',
};

// Activity level recommendations
export const ACTIVITY_LEVELS = {
  low: { label: 'Low Activity', description: 'Mostly indoor work' },
  moderate: { label: 'Moderate Activity', description: 'Mixed indoor/outdoor' },
  high: { label: 'High Activity', description: 'Mostly outdoor work' },
};

// Health condition sensitivities
export const SENSITIVITY_LEVELS = {
  child: 1.5,
  teen: 1.2,
  adult: 1.0,
  senior: 1.4,
  pregnant: 1.3,
  asthma: 1.6,
  copd: 1.7,
  heartDisease: 1.5,
};

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
};

// WebSocket events
export const WS_EVENTS = {
  AQI_UPDATE: 'aqi_update',
  ALERT_TRIGGERED: 'alert_triggered',
  FORECAST_UPDATE: 'forecast_update',
  SYSTEM_NOTIFICATION: 'system_notification',
};

export default {
  API_ENDPOINTS,
  AQI_THRESHOLDS,
  POLLUTANT_LIMITS,
  DEFAULT_ALERT_THRESHOLDS,
  CACHE_DURATIONS,
  SUPPORTED_CITIES,
  POLLUTANT_NAMES,
  ACTIVITY_LEVELS,
  SENSITIVITY_LEVELS,
  PAGINATION,
  WS_EVENTS,
};
