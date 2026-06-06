// Date and number formatting utilities for VayuGuard
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns';

/**
 * Format AQI value with padding
 */
export function formatAQI(aqi) {
  if (aqi === null || aqi === undefined) return '--';
  return aqi.toString().padStart(3, '0');
}

/**
 * Format pollutant concentration value
 */
export function formatPollutant(value, decimals = 1) {
  if (value === null || value === undefined) return '--';
  return Number(value).toFixed(decimals);
}

/**
 * Format date string
 */
export function formatDate(date, pattern = 'MMM d, yyyy') {
  if (!date) return '--';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsed)) return '--';
  return format(parsed, pattern);
}

/**
 * Format time string
 */
export function formatTime(date, pattern = 'h:mm a') {
  if (!date) return '--';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsed)) return '--';
  return format(parsed, pattern);
}

/**
 * Format date and time together
 */
export function formatDateTime(date) {
  return formatDate(date, 'MMM d, yyyy h:mm a');
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date) {
  if (!date) return '--';
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(parsed)) return '--';
  return formatDistanceToNow(parsed, { addSuffix: true });
}

/**
 * Format hour from 24h to 12h
 */
export function formatHour(hour24) {
  if (hour24 === undefined || hour24 === null) return '--';
  const h = parseInt(hour24);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12} ${ampm}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value, decimals = 0) {
  if (value === null || value === undefined) return '--';
  return `${Number(value).toFixed(decimals)}%`;
}

/**
 * Format number with commas
 */
export function formatNumber(value) {
  if (value === null || value === undefined) return '--';
  return Number(value).toLocaleString();
}

/**
 * Format compact number (e.g., 1.2K, 3.5M)
 */
export function formatCompactNumber(value) {
  if (value === null || value === undefined) return '--';
  const num = Number(value);
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return num.toString();
}

/**
 * Format AQI with unit
 */
export function formatAQIWithUnit(aqi) {
  return `${aqi} AQI`;
}

/**
 * Format pollutant value with unit
 */
export function formatPollutantWithUnit(value, pollutant) {
  const units = {
    pm25: 'µg/m³',
    pm10: 'µg/m³',
    no2: 'ppb',
    o3: 'ppb',
    so2: 'ppb',
    co: 'ppm',
  };
  const unit = units[pollutant?.toLowerCase()] || '';
  return `${formatPollutant(value)} ${unit}`;
}

/**
 * Format trend value with sign
 */
export function formatTrendValue(value) {
  if (value === 0) return '0';
  return value > 0 ? `+${value}` : `${value}`;
}

/**
 * Format duration in minutes to human-readable
 */
export function formatDuration(minutes) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default {
  formatAQI,
  formatPollutant,
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeTime,
  formatHour,
  formatPercentage,
  formatNumber,
  formatCompactNumber,
  formatAQIWithUnit,
  formatPollutantWithUnit,
  formatTrendValue,
  formatDuration,
};
