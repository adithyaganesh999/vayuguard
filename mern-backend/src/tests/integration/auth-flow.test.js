const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../../app');
const User = require('../../models/User');
const HealthProfile = require('../../models/HealthProfile');

jest.mock('../../services/alertScheduler', () => ({
  initAlertScheduler: jest.fn(),
}));

jest.mock('../../config/redis', () => ({
  connectRedis: jest.fn().mockResolvedValue(null),
  getRedisClient: jest.fn().mockReturnValue(null),
}));

describe('Auth Flow - Integration Tests', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await HealthProfile.deleteMany({});
  });

  describe('POST /api/auth/signup', () => {
    it('should register a new user and return tokens', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toHaveProperty('id');
      expect(res.body.data.user.email).toBe('test@example.com');
      expect(res.body.data.tokens).toHaveProperty('access');
      expect(res.body.data.tokens).toHaveProperty('refresh');

      // Verify user was created in DB
      const user = await User.findOne({ email: 'test@example.com' });
      expect(user).toBeTruthy();
      expect(user.name).toBe('Test User');

      // Verify health profile was created
      const profile = await HealthProfile.findOne({ userId: user._id });
      expect(profile).toBeTruthy();
    });

    it('should return 409 for duplicate email', async () => {
      // Create first user
      await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'First User',
          email: 'duplicate@example.com',
          password: 'password123',
        });

      // Try duplicate
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Second User',
          email: 'duplicate@example.com',
          password: 'password456',
        });

      expect(res.status).toBe(409);
    });

    it('should return 400 for invalid input', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: '',
          email: 'invalid-email',
          password: '123',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a user first
      await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Login User',
          email: 'login@example.com',
          password: 'password123',
        });
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens).toHaveProperty('access');
      expect(res.body.data.user.email).toBe('login@example.com');
    });

    it('should return 401 for wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
    });

    it('should return 401 for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      // Signup to get token
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Me User',
          email: 'me@example.com',
          password: 'password123',
        });

      const token = signupRes.body.data.tokens.access;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('me@example.com');
      expect(res.body.data).toHaveProperty('healthProfile');
    });

    it('should return 401 without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(res.status).toBe(401);
    });
  });

  describe('Full auth flow', () => {
    it('should complete signup → login → get profile → logout', async () => {
      // Step 1: Signup
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Flow User',
          email: 'flow@example.com',
          password: 'password123',
        });

      expect(signupRes.status).toBe(201);
      const { access, refresh } = signupRes.body.data.tokens;

      // Step 2: Get profile
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${access}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.user.name).toBe('Flow User');

      // Step 3: Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${access}`)
        .send({ refreshToken: refresh });

      expect(logoutRes.status).toBe(200);
    });
  });
});
