// Alert service for VayuGuard - handles alert CRUD API calls
import api from './api';

export const alertService = {
  // Get all alerts for current user
  async getAlerts() {
    const response = await api.get('/alerts');
    return response.data;
  },

  // Get a single alert by ID
  async getAlert(alertId) {
    const response = await api.get(`/alerts/${alertId}`);
    return response.data;
  },

  // Create a new alert
  async createAlert(alertData) {
    const response = await api.post('/alerts', alertData);
    return response.data;
  },

  // Update an existing alert
  async updateAlert(alertId, alertData) {
    const response = await api.put(`/alerts/${alertId}`, alertData);
    return response.data;
  },

  // Delete an alert
  async deleteAlert(alertId) {
    const response = await api.delete(`/alerts/${alertId}`);
    return response.data;
  },

  // Toggle alert active/inactive
  async toggleAlert(alertId, isActive) {
    const response = await api.patch(`/alerts/${alertId}`, { isActive });
    return response.data;
  },

  // Test an alert (trigger a test notification)
  async testAlert(alertId) {
    const response = await api.post(`/alerts/${alertId}/test`);
    return response.data;
  },

  // Get alert history/triggered alerts
  async getAlertHistory(params = {}) {
    const query = new URLSearchParams(params).toString();
    const response = await api.get(`/alerts/history?${query}`);
    return response.data;
  },

  // Bulk update alerts
  async bulkUpdateAlerts(updates) {
    const response = await api.patch('/alerts/bulk', updates);
    return response.data;
  },
};

export default alertService;
