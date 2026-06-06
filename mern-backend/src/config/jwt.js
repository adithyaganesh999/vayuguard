require('dotenv').config();

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'vayuguard-default-secret-change-in-production',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '7d',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'vayuguard-refresh-secret-change-in-production',
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '30d',
};
