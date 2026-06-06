#!/usr/bin/env node
/**
 * VayuGuard Demo Data Seeder
 *
 * Seeds MongoDB with demo users, AQI readings, alerts, and health profiles
 * for development and testing purposes.
 *
 * Usage: node scripts/seed-demo-data.js [--clean] [--verbose]
 *
 * Options:
 *   --clean    Drop existing collections before seeding
 *   --verbose  Print detailed output
 *
 * Environment Variables:
 *   MONGODB_URI  MongoDB connection string (default: mongodb://localhost:27017/vayuguard)
 */

const { MongoClient, ObjectId } = require('mongodb');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vayuguard';
const CLEAN = process.argv.includes('--clean');
const VERBOSE = process.argv.includes('--verbose');

// Color helpers
const colors = {
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  yellow: (t) => `\x1b[33m${t}\x1b[0m`,
  blue: (t) => `\x1b[34m${t}\x1b[0m`,
  cyan: (t) => `\x1b[36m${t}\x1b[0m`,
};

function log(msg) {
  if (VERBOSE) console.log(msg);
}

// ─── Demo Data ─────────────────────────────────────────

const DEMO_USERS = [
  {
    _id: new ObjectId('000000000000000000000001'),
    name: 'Admin User',
    email: 'admin@vayuguard.com',
    password: '$2a$12$LJ3m4ys3Lk0TSwMdMuMXOeWUQXfdtQB2gXBqJGKjY6OuWzWmDkqKG', // "Admin123!"
    role: 'admin',
    isActive: true,
    lastLogin: new Date('2025-01-15T10:30:00Z'),
    preferences: {
      language: 'en',
      timezone: 'Asia/Kolkata',
      units: 'metric',
      notificationsEnabled: true,
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-15T10:30:00Z'),
  },
  {
    _id: new ObjectId('000000000000000000000002'),
    name: 'Priya Sharma',
    email: 'priya@example.com',
    password: '$2a$12$LJ3m4ys3Lk0TSwMdMuMXOeWUQXfdtQB2gXBqJGKjY6OuWzWmDkqKG', // "Admin123!"
    role: 'user',
    isActive: true,
    lastLogin: new Date('2025-01-14T15:45:00Z'),
    preferences: {
      language: 'en',
      timezone: 'Asia/Kolkata',
      units: 'metric',
      notificationsEnabled: true,
    },
    createdAt: new Date('2024-03-15T09:00:00Z'),
    updatedAt: new Date('2025-01-14T15:45:00Z'),
  },
  {
    _id: new ObjectId('000000000000000000000003'),
    name: 'Rajesh Kumar',
    email: 'rajesh@example.com',
    password: '$2a$12$LJ3m4ys3Lk0TSwMdMuMXOeWUQXfdtQB2gXBqJGKjY6OuWzWmDkqKG', // "Admin123!"
    role: 'user',
    isActive: true,
    lastLogin: new Date('2025-01-13T08:20:00Z'),
    preferences: {
      language: 'en',
      timezone: 'Asia/Kolkata',
      units: 'metric',
      notificationsEnabled: false,
    },
    createdAt: new Date('2024-06-20T14:30:00Z'),
    updatedAt: new Date('2025-01-13T08:20:00Z'),
  },
  {
    _id: new ObjectId('000000000000000000000004'),
    name: 'Ananya Patel',
    email: 'ananya@example.com',
    password: '$2a$12$LJ3m4ys3Lk0TSwMdMuMXOeWUQXfdtQB2gXBqJGKjY6OuWzWmDkqKG', // "Admin123!"
    role: 'user',
    isActive: true,
    lastLogin: new Date('2025-01-12T17:00:00Z'),
    preferences: {
      language: 'en',
      timezone: 'Asia/Kolkata',
      units: 'metric',
      notificationsEnabled: true,
    },
    createdAt: new Date('2024-09-10T11:15:00Z'),
    updatedAt: new Date('2025-01-12T17:00:00Z'),
  },
  {
    _id: new ObjectId('000000000000000000000005'),
    name: 'Vikram Singh',
    email: 'vikram@example.com',
    password: '$2a$12$LJ3m4ys3Lk0TSwMdMuMXOeWUQXfdtQB2gXBqJGKjY6OuWzWmDkqKG', // "Admin123!"
    role: 'user',
    isActive: false,
    lastLogin: new Date('2024-11-01T09:00:00Z'),
    preferences: {
      language: 'en',
      timezone: 'Asia/Kolkata',
      units: 'metric',
      notificationsEnabled: true,
    },
    createdAt: new Date('2024-08-05T16:00:00Z'),
    updatedAt: new Date('2024-11-01T09:00:00Z'),
  },
];

const DEMO_HEALTH_PROFILES = [
  {
    _id: new ObjectId('000000000000000000000101'),
    userId: new ObjectId('000000000000000000000002'),
    age: 32,
    gender: 'female',
    conditions: ['asthma'],
    sensitivityLevel: 'high',
    activityLevel: 'moderate',
    smokingStatus: 'never',
    location: { type: 'Point', coordinates: [77.209, 28.6139] },
    locationName: 'South Delhi, Delhi',
    emergencyContact: {
      name: 'Amit Sharma',
      phone: '+91-9876543210',
      relationship: 'spouse',
    },
    createdAt: new Date('2024-03-20T10:00:00Z'),
    updatedAt: new Date('2025-01-10T08:00:00Z'),
  },
  {
    _id: new ObjectId('000000000000000000000102'),
    userId: new ObjectId('000000000000000000000003'),
    age: 55,
    gender: 'male',
    conditions: ['hypertension', 'diabetes'],
    sensitivityLevel: 'very-high',
    activityLevel: 'light',
    smokingStatus: 'former',
    location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    locationName: 'Koramangala, Bangalore',
    emergencyContact: {
      name: 'Meena Kumar',
      phone: '+91-9876543211',
      relationship: 'spouse',
    },
    createdAt: new Date('2024-06-25T12:00:00Z'),
    updatedAt: new Date('2025-01-08T14:00:00Z'),
  },
  {
    _id: new ObjectId('000000000000000000000103'),
    userId: new ObjectId('000000000000000000000004'),
    age: 24,
    gender: 'female',
    conditions: [],
    sensitivityLevel: 'low',
    activityLevel: 'very-active',
    smokingStatus: 'never',
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    locationName: 'Bandra, Mumbai',
    createdAt: new Date('2024-09-15T09:00:00Z'),
    updatedAt: new Date('2025-01-12T11:00:00Z'),
  },
];

const DEMO_ALERT_SUBSCRIPTIONS = [
  {
    _id: new ObjectId('000000000000000000000201'),
    userId: new ObjectId('000000000000000000000002'),
    location: { type: 'Point', coordinates: [77.209, 28.6139] },
    locationName: 'Home - South Delhi',
    locationId: new ObjectId('000000000000000000000301'),
    thresholds: {
      aqiLevel: 'unhealthy-sensitive',
      aqiValue: 100,
      pollutants: ['pm25', 'pm10'],
    },
    schedule: {
      frequency: 'hourly',
      quietHours: { start: '22:00', end: '07:00' },
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    },
    channels: { email: true, push: true, sms: false },
    isActive: true,
    lastTriggered: new Date('2025-01-10T14:00:00Z'),
    createdAt: new Date('2024-04-01T10:00:00Z'),
    updatedAt: new Date('2025-01-10T14:00:00Z'),
  },
  {
    _id: new ObjectId('000000000000000000000202'),
    userId: new ObjectId('000000000000000000000003'),
    location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    locationName: 'Home - Koramangala',
    thresholds: {
      aqiLevel: 'unhealthy',
      aqiValue: 150,
      pollutants: ['pm25'],
    },
    schedule: {
      frequency: 'daily',
      quietHours: { start: '23:00', end: '06:00' },
      days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    },
    channels: { email: true, push: false, sms: true },
    isActive: true,
    lastTriggered: new Date('2025-01-05T08:00:00Z'),
    createdAt: new Date('2024-07-01T12:00:00Z'),
    updatedAt: new Date('2025-01-05T08:00:00Z'),
  },
  {
    _id: new ObjectId('000000000000000000000203'),
    userId: new ObjectId('000000000000000000000004'),
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    locationName: 'Office - Bandra',
    thresholds: {
      aqiLevel: 'moderate',
      aqiValue: 80,
      pollutants: ['pm25', 'o3'],
    },
    schedule: {
      frequency: 'realtime',
      quietHours: { start: '00:00', end: '06:00' },
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    },
    channels: { email: false, push: true, sms: false },
    isActive: true,
    createdAt: new Date('2024-10-01T09:00:00Z'),
    updatedAt: new Date('2024-10-01T09:00:00Z'),
  },
];

const DEMO_SAVED_LOCATIONS = [
  {
    _id: new ObjectId('000000000000000000000301'),
    userId: new ObjectId('000000000000000000000002'),
    name: 'Home',
    location: { type: 'Point', coordinates: [77.209, 28.6139] },
    address: { street: '12 Green Park', city: 'New Delhi', state: 'Delhi', country: 'India', postalCode: '110016' },
    isPrimary: true,
    stationId: 'DL_ITO',
    stationDistance: 2.5,
    notes: 'Near Green Park metro station',
    tags: ['home'],
    createdAt: new Date('2024-03-20T10:00:00Z'),
    updatedAt: new Date('2024-03-20T10:00:00Z'),
  },
  {
    _id: new ObjectId('000000000000000000000302'),
    userId: new ObjectId('000000000000000000000002'),
    name: 'Office',
    location: { type: 'Point', coordinates: [77.2295, 28.6127] },
    address: { street: 'Connaught Place', city: 'New Delhi', state: 'Delhi', country: 'India', postalCode: '110001' },
    isPrimary: false,
    stationId: 'DL_CP',
    stationDistance: 0.8,
    tags: ['office', 'work'],
    createdAt: new Date('2024-04-15T11:00:00Z'),
    updatedAt: new Date('2024-04-15T11:00:00Z'),
  },
  {
    _id: new ObjectId('000000000000000000000303'),
    userId: new ObjectId('000000000000000000000003'),
    name: 'Home',
    location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    address: { street: '100 Feet Road', city: 'Bangalore', state: 'Karnataka', country: 'India', postalCode: '560034' },
    isPrimary: true,
    stationId: 'KA_KORM',
    stationDistance: 1.2,
    tags: ['home'],
    createdAt: new Date('2024-06-25T12:00:00Z'),
    updatedAt: new Date('2024-06-25T12:00:00Z'),
  },
  {
    _id: new ObjectId('000000000000000000000304'),
    userId: new ObjectId('000000000000000000000004'),
    name: 'Home',
    location: { type: 'Point', coordinates: [72.8777, 19.076] },
    address: { street: 'Hill Road', city: 'Mumbai', state: 'Maharashtra', country: 'India', postalCode: '400050' },
    isPrimary: true,
    stationId: 'MH_BANDRA',
    stationDistance: 3.1,
    tags: ['home'],
    createdAt: new Date('2024-09-15T09:00:00Z'),
    updatedAt: new Date('2024-09-15T09:00:00Z'),
  },
];

// Generate demo notifications
function generateNotifications() {
  const notifications = [];
  const types = ['alert', 'forecast', 'health-advisory', 'system'];
  const priorities = ['low', 'medium', 'high', 'critical'];
  const messages = [
    { title: 'AQI Alert: Unhealthy Levels', message: 'AQI in your area has reached 165 (Unhealthy). Consider staying indoors.' },
    { title: 'Forecast: Improving Air Quality', message: 'Air quality is expected to improve to Moderate levels by tomorrow morning.' },
    { title: 'Health Advisory', message: 'Based on your health profile, limit outdoor exposure today due to high PM2.5 levels.' },
    { title: 'Weekly Air Quality Report', message: 'Your weekly air quality summary is ready. Average AQI: 112 (USG).' },
    { title: 'AQI Alert: Very Unhealthy', message: 'AQI has exceeded 200. Avoid all outdoor activities if possible.' },
    { title: 'Morning Forecast', message: 'Good morning! Today\'s AQI forecast: 95-120 (Moderate to USG). Best window: 6-8 AM.' },
  ];

  for (let i = 0; i < 20; i++) {
    const msg = messages[i % messages.length];
    const userIdIndex = i % 4;
    notifications.push({
      _id: new ObjectId(`0000000000000000000004${String(i).padStart(2, '0')}`),
      userId: DEMO_USERS[userIdIndex + 1]._id,
      type: types[i % types.length],
      priority: priorities[i % priorities.length],
      title: msg.title,
      message: msg.message,
      data: {
        aqiValue: 100 + Math.floor(Math.random() * 150),
        locationName: ['South Delhi', 'Koramangala', 'Bandra'][userIdIndex],
        thresholdExceeded: i % 3 === 0 ? 'pm25' : null,
      },
      channels: {
        email: { sent: true, sentAt: new Date(Date.now() - i * 3600000) },
        push: { sent: i % 2 === 0, sentAt: i % 2 === 0 ? new Date(Date.now() - i * 3600000) : null },
        sms: { sent: false },
      },
      isRead: i > 5,
      readAt: i > 5 ? new Date(Date.now() - (i - 5) * 1800000) : null,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600000),
      createdAt: new Date(Date.now() - i * 3600000),
    });
  }
  return notifications;
}

// ─── Main Seeding Logic ─────────────────────────────────

async function seed() {
  console.log(colors.cyan('═══════════════════════════════════════════════════'));
  console.log(colors.cyan('  VayuGuard Demo Data Seeder'));
  console.log(colors.cyan('═══════════════════════════════════════════════════'));
  console.log('');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log(colors.green('✅ Connected to MongoDB'));

    const db = client.db();

    // Clean collections if requested
    if (CLEAN) {
      console.log(colors.yellow('\n🗑️  Cleaning existing collections...'));
      const collections = ['users', 'healthprofiles', 'alertsubscriptions', 'savedlocations', 'notifications'];
      for (const col of collections) {
        try {
          await db.collection(col).drop();
          log(`  Dropped: ${col}`);
        } catch (e) {
          log(`  Skipped: ${col} (does not exist)`);
        }
      }
      console.log(colors.green('✅ Collections cleaned'));
    }

    // Seed Users
    console.log(colors.blue('\n👥 Seeding users...'));
    const usersResult = await db.collection('users').insertMany(DEMO_USERS);
    console.log(colors.green(`  ✅ Inserted ${usersResult.insertedCount} users`));

    // Seed Health Profiles
    console.log(colors.blue('\n🏥 Seeding health profiles...'));
    const profilesResult = await db.collection('healthprofiles').insertMany(DEMO_HEALTH_PROFILES);
    console.log(colors.green(`  ✅ Inserted ${profilesResult.insertedCount} health profiles`));

    // Seed Alert Subscriptions
    console.log(colors.blue('\n🔔 Seeding alert subscriptions...'));
    const alertsResult = await db.collection('alertsubscriptions').insertMany(DEMO_ALERT_SUBSCRIPTIONS);
    console.log(colors.green(`  ✅ Inserted ${alertsResult.insertedCount} alert subscriptions`));

    // Seed Saved Locations
    console.log(colors.blue('\n📍 Seeding saved locations...'));
    const locationsResult = await db.collection('savedlocations').insertMany(DEMO_SAVED_LOCATIONS);
    console.log(colors.green(`  ✅ Inserted ${locationsResult.insertedCount} saved locations`));

    // Seed Notifications
    console.log(colors.blue('\n📬 Seeding notifications...'));
    const demoNotifications = generateNotifications();
    const notificationsResult = await db.collection('notifications').insertMany(demoNotifications);
    console.log(colors.green(`  ✅ Inserted ${notificationsResult.insertedCount} notifications`));

    // Create indexes
    console.log(colors.blue('\n📇 Creating indexes...'));
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('healthprofiles').createIndex({ userId: 1 }, { unique: true });
    await db.collection('healthprofiles').createIndex({ location: '2dsphere' });
    await db.collection('alertsubscriptions').createIndex({ userId: 1, isActive: 1 });
    await db.collection('alertsubscriptions').createIndex({ location: '2dsphere' });
    await db.collection('savedlocations').createIndex({ userId: 1, isPrimary: 1 });
    await db.collection('savedlocations').createIndex({ location: '2dsphere' });
    await db.collection('notifications').createIndex({ userId: 1, isRead: 1 });
    await db.collection('notifications').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    console.log(colors.green('  ✅ Indexes created'));

    // Summary
    console.log('\n' + colors.cyan('═══════════════════════════════════════════════════'));
    console.log(colors.green('  ✅ Demo data seeding complete!'));
    console.log(colors.cyan('═══════════════════════════════════════════════════'));
    console.log('');
    console.log('  Demo accounts:');
    console.log('  ┌────────────────────────┬──────────────────────┬────────┐');
    console.log('  │ Email                  │ Password             │ Role   │');
    console.log('  ├────────────────────────┼──────────────────────┼────────┤');
    console.log('  │ admin@vayuguard.com    │ Admin123!            │ admin  │');
    console.log('  │ priya@example.com      │ Admin123!            │ user   │');
    console.log('  │ rajesh@example.com     │ Admin123!            │ user   │');
    console.log('  │ ananya@example.com     │ Admin123!            │ user   │');
    console.log('  └────────────────────────┴──────────────────────┴────────┘');
    console.log('');

  } catch (error) {
    console.error(colors.red('\n❌ Seeding failed:'), error.message);
    process.exit(1);
  } finally {
    await client.close();
    log('MongoDB connection closed');
  }
}

// Run
seed().catch((err) => {
  console.error(colors.red('Fatal error:'), err);
  process.exit(1);
});
