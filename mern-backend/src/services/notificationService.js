const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

/**
 * Email transporter configuration
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  });
};

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

/**
 * Send email notification
 */
async function sendEmail({ to, subject, html, text }) {
  try {
    const transport = getTransporter();
    const info = await transport.sendMail({
      from: `"VayuGuard" <${process.env.EMAIL_FROM || 'noreply@vayuguard.com'}>`,
      to,
      subject,
      html,
      text: text || subject,
    });

    logger.info(`[Notification] Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`[Notification] Email failed for ${to}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Send AQI alert email
 */
async function sendAQIAlertEmail(userEmail, alertData) {
  const { condition, location, currentAQI, forecastData } = alertData;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">⚠️ VayuGuard Air Quality Alert</h2>
      <p>Attention! The air quality in <strong>${location}</strong> has exceeded your alert threshold.</p>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Condition:</strong> ${condition}</p>
        <p><strong>Current AQI:</strong> ${currentAQI}</p>
        ${forecastData ? `<p><strong>Forecast:</strong> ${JSON.stringify(forecastData)}</p>` : ''}
      </div>
      <p>Please take necessary precautions based on your health profile.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px;">You received this email because you subscribed to VayuGuard alerts. 
      Manage your subscriptions in your account settings.</p>
    </div>
  `;

  return sendEmail({
    to: userEmail,
    subject: `VayuGuard Alert: Air quality threshold exceeded in ${location}`,
    html,
  });
}

/**
 * Send push notification (placeholder for FCM integration)
 */
async function sendPushNotification({ userId, title, body, data = {} }) {
  try {
    // In production, integrate with Firebase Cloud Messaging (FCM)
    // or another push notification service
    logger.info(`[Notification] Push sent to user ${userId}: ${title}`);
    return { success: true, message: 'Push notification queued' };
  } catch (error) {
    logger.error(`[Notification] Push failed for user ${userId}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Send SMS notification (placeholder for Twilio integration)
 */
async function sendSMS({ to, message }) {
  try {
    // In production, integrate with Twilio or similar
    logger.info(`[Notification] SMS sent to ${to}: ${message.substring(0, 50)}...`);
    return { success: true, message: 'SMS queued' };
  } catch (error) {
    logger.error(`[Notification] SMS failed for ${to}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification through the user's preferred channel
 */
async function sendNotification(user, notification) {
  const results = [];

  // Always create an in-app notification
  const Notification = require('../models/Notification');
  await Notification.create({
    userId: user._id,
    message: notification.message,
    type: notification.type || 'alert',
    metadata: notification.metadata,
  });

  // Send through user's preferred channel
  if (notification.channel === 'email' || !notification.channel) {
    const result = await sendAQIAlertEmail(user.email, notification);
    results.push({ channel: 'email', ...result });
  }

  if (notification.channel === 'push') {
    const result = await sendPushNotification({
      userId: user._id,
      title: notification.title || 'VayuGuard Alert',
      body: notification.message,
      data: notification.metadata,
    });
    results.push({ channel: 'push', ...result });
  }

  if (notification.channel === 'sms' && user.phone) {
    const result = await sendSMS({
      to: user.phone,
      message: notification.message,
    });
    results.push({ channel: 'sms', ...result });
  }

  return results;
}

module.exports = {
  sendEmail,
  sendAQIAlertEmail,
  sendPushNotification,
  sendSMS,
  sendNotification,
};
