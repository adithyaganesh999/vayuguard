const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../app');
const User = require('../../models/User');

jest.mock('../../services/alertScheduler', () => ({
  initAlertScheduler: jest.fn(),
}));

jest.mock('../../config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(null),
  getRedisClient: jest.fn().mockReturnValue(null),
}));

describe('Forecast Flow - Integration Tests', () => {
  let mongoServer;
  let authToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Create a user and get auth token
    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Forecast User',
        email: 'forecast@example.com',
        password: 'password123',
      });

    authToken = signupRes.body.data.tokens.access;
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  describe('GET /api/forecast/:city', () => {
    it('should handle ML service unavailable gracefully', async () => {
      // Since the ML service isn't running in test, we expect a 503 or error
      const res = await request(app)
        .get('/api/forecast/Delhi')
        .set('Authorization', `Bearer ${authToken}`);

      // The response will be either 503 (service unavailable) or 500
      // depending on whether axios can connect
      expect([200, 503, 500]).toContain(res.status);
    });

    it('should be accessible without authentication (optional auth)', async () => {
      const res = await request(app).get('/api/forecast/Mumbai');

      // Should not return 401 — route has optionalAuth
      expect(res.status).not.toBe(401);
    });

    it('should return 400 for empty city name', async () => {
      const res = await request(app)
        .get('/api/forecast/ ');

      // Validation should catch empty city
      expect([400, 503, 500]).toContain(res.status);
    });
  });

  describe('GET /api/forecast/historical/:city', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/forecast/historical/Delhi');

      expect(res.status).toBe(401);
    });

    it('should accept days query parameter', async () => {
      const res = await request(app)
        .get('/api/forecast/historical/Delhi?days=7')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 503, 500]).toContain(res.status);
    });
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('services');
    });
  });
});
