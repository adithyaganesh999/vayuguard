const { createAlert, getAlerts, updateAlert, deleteAlert } = require('../../controllers/alertController');
const AlertSubscription = require('../../models/AlertSubscription');

jest.mock('../../models/AlertSubscription');
jest.mock('../../utils/logger');

describe('Alert Controller - Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {}, params: {}, query: {}, user: { _id: 'user123' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('createAlert', () => {
    it('should create a new alert subscription', async () => {
      req.body = {
        condition: 'AQI>100',
        location: 'Delhi',
        frequency: 'hourly',
        channel: 'email',
      };

      AlertSubscription.countDocuments.mockResolvedValue(5);
      AlertSubscription.create.mockResolvedValue({
        _id: 'alert123',
        userId: 'user123',
        condition: 'AQI>100',
        location: 'Delhi',
        frequency: 'hourly',
        channel: 'email',
      });

      await createAlert(req, res, next);

      expect(AlertSubscription.countDocuments).toHaveBeenCalledWith({
        userId: 'user123',
        active: true,
      });
      expect(AlertSubscription.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 if user has max alerts', async () => {
      req.body = {
        condition: 'AQI>100',
        location: 'Delhi',
      };

      AlertSubscription.countDocuments.mockResolvedValue(20);

      await createAlert(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should use default frequency and channel if not provided', async () => {
      req.body = {
        condition: 'AQI>100',
        location: 'Delhi',
      };

      AlertSubscription.countDocuments.mockResolvedValue(0);
      AlertSubscription.create.mockResolvedValue({
        _id: 'alert123',
        condition: 'AQI>100',
        location: 'Delhi',
        frequency: 'hourly',
        channel: 'email',
      });

      await createAlert(req, res, next);

      expect(AlertSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          frequency: 'hourly',
          channel: 'email',
        })
      );
    });
  });

  describe('getAlerts', () => {
    it('should return paginated alerts', async () => {
      req.query = { page: '1', limit: '10' };

      const mockAlerts = [
        { _id: 'alert1', condition: 'AQI>100', location: 'Delhi' },
        { _id: 'alert2', condition: 'PM25>35', location: 'Mumbai' },
      ];

      AlertSubscription.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockAlerts),
            }),
          }),
        }),
      });
      AlertSubscription.countDocuments.mockResolvedValue(2);

      await getAlerts(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should filter by active status', async () => {
      req.query = { active: 'true' };

      AlertSubscription.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      AlertSubscription.countDocuments.mockResolvedValue(0);

      await getAlerts(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('updateAlert', () => {
    it('should update an existing alert', async () => {
      req.params = { id: 'alert123' };
      req.body = { active: false };

      AlertSubscription.findOneAndUpdate.mockResolvedValue({
        _id: 'alert123',
        active: false,
      });

      await updateAlert(req, res, next);

      expect(AlertSubscription.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'alert123', userId: 'user123' },
        { $set: { active: false } },
        { new: true, runValidators: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if alert not found', async () => {
      req.params = { id: 'nonexistent' };
      req.body = { active: false };

      AlertSubscription.findOneAndUpdate.mockResolvedValue(null);

      await updateAlert(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteAlert', () => {
    it('should delete an alert', async () => {
      req.params = { id: 'alert123' };

      AlertSubscription.findOneAndDelete.mockResolvedValue({
        _id: 'alert123',
        condition: 'AQI>100',
      });

      await deleteAlert(req, res, next);

      expect(AlertSubscription.findOneAndDelete).toHaveBeenCalledWith({
        _id: 'alert123',
        userId: 'user123',
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if alert not found', async () => {
      req.params = { id: 'nonexistent' };

      AlertSubscription.findOneAndDelete.mockResolvedValue(null);

      await deleteAlert(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
