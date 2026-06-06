// AQI Color Coding utilities for VayuGuard

// AQI category color mapping
export const AQI_COLORS = {
  good: '#10b981',
  moderate: '#f59e0b',
  unhealthySensitive: '#f97316',
  unhealthy: '#ef4444',
  veryUnhealthy: '#a855f7',
  hazardous: '#dc2626',
};

// AQI level color mapping with ranges
export const AQI_LEVEL_COLORS = [
  { min: 0, max: 50, color: '#10b981', label: 'Good', bgColor: 'rgba(16,185,129,0.15)' },
  { min: 51, max: 100, color: '#f59e0b', label: 'Moderate', bgColor: 'rgba(245,158,11,0.15)' },
  { min: 101, max: 150, color: '#f97316', label: 'Unhealthy for Sensitive Groups', bgColor: 'rgba(249,115,22,0.15)' },
  { min: 151, max: 200, color: '#ef4444', label: 'Unhealthy', bgColor: 'rgba(239,68,68,0.15)' },
  { min: 201, max: 300, color: '#a855f7', label: 'Very Unhealthy', bgColor: 'rgba(168,85,247,0.15)' },
  { min: 301, max: 500, color: '#dc2626', label: 'Hazardous', bgColor: 'rgba(220,38,38,0.15)' },
];

/**
 * Get AQI color based on value
 */
export function getAQIColorValue(aqi) {
  const level = AQI_LEVEL_COLORS.find((l) => aqi >= l.min && aqi <= l.max);
  return level?.color || '#dc2626';
}

/**
 * Get AQI background color with opacity
 */
export function getAQIBgColor(aqi, opacity = 0.15) {
  const color = getAQIColorValue(aqi);
  // Convert hex to rgba
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/**
 * Get AQI label based on value
 */
export function getAQILabel(aqi) {
  const level = AQI_LEVEL_COLORS.find((l) => aqi >= l.min && aqi <= l.max);
  return level?.label || 'Hazardous';
}

/**
 * Get gradient colors for AQI range
 */
export function getAQIGradient(aqi) {
  if (aqi <= 50) return ['#10b981', '#059669'];
  if (aqi <= 100) return ['#f59e0b', '#d97706'];
  if (aqi <= 150) return ['#f97316', '#ea580c'];
  if (aqi <= 200) return ['#ef4444', '#dc2626'];
  if (aqi <= 300) return ['#a855f7', '#9333ea'];
  return ['#dc2626', '#991b1b'];
}

/**
 * Get pollutant color
 */
export function getPollutantColor(pollutant) {
  const colors = {
    pm25: '#0ea5e9',
    pm10: '#f59e0b',
    no2: '#a855f7',
    o3: '#f97316',
    so2: '#ef4444',
    co: '#6366f1',
  };
  return colors[pollutant?.toLowerCase()] || '#10b981';
}

/**
 * Get color for trend direction
 */
export function getTrendColor(trend) {
  switch (trend) {
    case 'up':
      return '#ef4444'; // Red - AQI increasing (bad)
    case 'down':
      return '#10b981'; // Green - AQI decreasing (good)
    case 'stable':
      return '#f59e0b'; // Amber - no change
    default:
      return '#6b7280';
  }
}

/**
 * Interpolate color between two AQI values
 */
export function interpolateAQIColor(aqi1, aqi2, t) {
  const color1 = getAQIColorValue(aqi1);
  const color2 = getAQIColorValue(aqi2);

  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  return `rgb(${r},${g},${b})`;
}

export default {
  AQI_COLORS,
  AQI_LEVEL_COLORS,
  getAQIColorValue,
  getAQIBgColor,
  getAQILabel,
  getAQIGradient,
  getPollutantColor,
  getTrendColor,
  interpolateAQIColor,
};
