const cron = require('node-cron');
const AlertSubscription = require('../models/AlertSubscription');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getCurrentAQI } = require('./mlClient');
const { sendNotification } = require('./notificationService');
const logger = require('../utils/logger');
const { parseAQIThreshold } = require('../utils/validators');

/**
 * Check AQI thresholds for all active alerts
 */
async function checkThresholds() {
  logger.info('[AlertScheduler] Starting threshold check...');

  try {
    // Get all active alert subscriptions, grouped by location
    const activeAlerts = await AlertSubscription.find({ active: true }).lean();

    if (activeAlerts.length === 0) {
      logger.info('[AlertScheduler] No active alerts to check');
      return;
    }

    // Group by location for efficient API calls
    const locationGroups = {};
    activeAlerts.forEach((alert) => {
      const key = alert.lat && alert.lon ? `${alert.lat},${alert.lon}` : alert.location;
      if (!locationGroups[key]) {
        locationGroups[key] = [];
      }
      locationGroups[key].push(alert);
    });

    logger.info(
      `[AlertScheduler] Checking ${activeAlerts.length} alerts across ${Object.keys(locationGroups).length} locations`
    );

    let alertsTriggered = 0;

    // Process each location
    for (const [locationKey, alerts] of Object.entries(locationGroups)) {
      try {
        let aqiData;

        // Fetch current AQI for this location
        if (locationKey.includes(',')) {
          const [lat, lon] = locationKey.split(',').map(Number);
          aqiData = await getCurrentAQI(lat, lon);
        } else {
          // For city-name based alerts, use approximate coordinates or ML service
          aqiData = await getCurrentAQI(0, 0); // Fallback — would need geocoding in production
        }

        if (!aqiData || aqiData.aqi === undefined) {
          logger.warn(`[AlertScheduler] No AQI data for location: ${locationKey}`);
          continue;
        }

        // Check each alert's condition against current AQI
        for (const alert of alerts) {
          const threshold = parseAQIThreshold(alert.condition);
          if (threshold === null) continue;

          const currentAQI = aqiData.aqi;
          const exceeded = currentAQI > threshold;

          if (exceeded) {
            // Check if we recently triggered this alert (avoid spam)
            const cooldownPeriod = {
              realtime: 15 * 60 * 1000,  // 15 minutes
              hourly: 60 * 60 * 1000,    // 1 hour
              daily: 24 * 60 * 60 * 1000, // 24 hours
            };
            const cooldown = cooldownPeriod[alert.frequency] || cooldownPeriod.hourly;

            if (alert.lastTriggered && Date.now() - new Date(alert.lastTriggered).getTime() < cooldown) {
              continue; // Skip — still in cooldown
            }

            // Find the user
            const user = await User.findById(alert.userId);
            if (!user || user.isSuspended) continue;

            // Send notification
            await sendNotification(user, {
              channel: alert.channel,
              message: `Air quality alert: ${alert.condition} triggered at ${alert.location}. Current AQI: ${currentAQI}`,
              title: 'VayuGuard Air Quality Alert',
              type: 'alert',
              metadata: {
                alertId: alert._id,
                condition: alert.condition,
                location: alert.location,
                currentAQI,
                threshold,
              },
            });

            // Update last triggered time
            await AlertSubscription.findByIdAndUpdate(alert._id, {
              lastTriggered: new Date(),
            });

            alertsTriggered++;
            logger.info(
              `[AlertScheduler] Alert triggered: ${alert.condition} at ${alert.location} (AQI: ${currentAQI})`
            );
          }
        }
      } catch (error) {
        logger.error(`[AlertScheduler] Error processing location ${locationKey}: ${error.message}`);
      }
    }

    logger.info(`[AlertScheduler] Check complete. ${alertsTriggered} alerts triggered.`);
  } catch (error) {
    logger.error(`[AlertScheduler] Threshold check failed: ${error.message}`);
  }
}

/**
 * Clean up old read notifications (older than 30 days)
 */
async function cleanupOldNotifications() {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await Notification.deleteMany({
      read: true,
      createdAt: { $lt: thirtyDaysAgo },
    });
    logger.info(`[AlertScheduler] Cleaned up ${result.deletedCount} old notifications`);
  } catch (error) {
    logger.error(`[AlertScheduler] Notification cleanup failed: ${error.message}`);
  }
}

/**
 * Initialize cron jobs
 */
function initAlertScheduler() {
  // Check thresholds every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    logger.info('[AlertScheduler] Running scheduled threshold check');
    checkThresholds();
  });

  // Cleanup old notifications daily at 3 AM
  cron.schedule('0 3 * * *', () => {
    logger.info('[AlertScheduler] Running daily notification cleanup');
    cleanupOldNotifications();
  });

  logger.info('[AlertScheduler] Cron jobs initialized');
}

module.exports = { initAlertScheduler, checkThresholds, cleanupOldNotifications };
