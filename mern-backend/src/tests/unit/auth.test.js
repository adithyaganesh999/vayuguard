const { signup, login, me, logout } = require('../../controllers/authController');
const User = require('../../models/User');
const HealthProfile = require('../../models/HealthProfile');

// Mock dependencies
jest.mock('../../models/User');
jest.mock('../../models/HealthProfile');
jest.mock('../../utils/logger');

describe('Auth Controller - Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, user: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('signup', () => {
    it('should create a new user and return tokens', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        _id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
        role: 'user',
        refreshTokens: [],
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      HealthProfile.create.mockResolvedValue({ userId: 'user123' });

      await signup(req, res, next);

      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(User.create).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'password123',
        phone: undefined,
        location: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 409 if email already exists', async () => {
      req.body = {
        name: 'Test User',
        email: 'existing@example.com',
        password: 'password123',
      };

      User.findOne.mockResolvedValue({ email: 'existing@example.com' });

      await signup(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should call next on unexpected error', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      User.findOne.mockRejectedValue(new Error('Database error'));

      await signup(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        isSuspended: false,
        refreshTokens: [],
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await login(req, res, next);

      expect(mockUser.comparePassword).toHaveBeenCalledWith('password123');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 401 for invalid email', async () => {
      req.body = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 for wrong password', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const mockUser = {
        _id: 'user123',
        isSuspended: false,
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 for suspended user', async () => {
      req.body = {
        email: 'suspended@example.com',
        password: 'password123',
      };

      const mockUser = {
        _id: 'user123',
        isSuspended: true,
        comparePassword: jest.fn().mockResolvedValue(true),
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      await login(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('me', () => {
    it('should return user profile with health profile', async () => {
      req.user = { _id: 'user123' };

      const mockUser = {
        _id: 'user123',
        name: 'Test User',
        email: 'test@example.com',
      };
      const mockHealthProfile = { userId: 'user123', asthmaPatient: false };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      HealthProfile.findOne.mockResolvedValue(mockHealthProfile);

      await me(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: mockUser,
            healthProfile: mockHealthProfile,
          }),
        })
      );
    });

    it('should return 404 if user not found', async () => {
      req.user = { _id: 'nonexistent' };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await me(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('logout', () => {
    it('should invalidate refresh token', async () => {
      req.user = { id: 'user123' };
      req.body = { refreshToken: 'token123' };

      User.findByIdAndUpdate.mockResolvedValue({});

      await logout(req, res, next);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { $pull: { refreshTokens: 'token123' } }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should clear all refresh tokens if no token provided', async () => {
      req.user = { id: 'user123' };
      req.body = {};

      User.findByIdAndUpdate.mockResolvedValue({});

      await logout(req, res, next);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'user123',
        { $set: { refreshTokens: [] } }
      );
    });
  });
});
