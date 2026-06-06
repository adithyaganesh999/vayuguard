// Profile service for VayuGuard - handles user profile API calls
import api from './api';

export const profileService = {
  // Get user profile
  async getProfile() {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  // Update user profile
  async updateProfile(updates) {
    const response = await api.patch('/auth/profile', updates);
    return response.data;
  },

  // Get saved locations
  async getSavedLocations() {
    const response = await api.get('/profile/locations');
    return response.data;
  },

  // Add a saved location
  async addSavedLocation(locationData) {
    const response = await api.post('/profile/locations', locationData);
    return response.data;
  },

  // Remove a saved location
  async removeSavedLocation(locationId) {
    const response = await api.delete(`/profile/locations/${locationId}`);
    return response.data;
  },

  // Set primary location
  async setPrimaryLocation(locationId) {
    const response = await api.patch(`/profile/locations/${locationId}`, { isPrimary: true });
    return response.data;
  },

  // Get notification preferences
  async getNotificationPrefs() {
    const response = await api.get('/profile/notifications');
    return response.data;
  },

  // Update notification preferences
  async updateNotificationPrefs(prefs) {
    const response = await api.put('/profile/notifications', prefs);
    return response.data;
  },

  // Get health profile
  async getHealthProfile() {
    const response = await api.get('/profile/health');
    return response.data;
  },

  // Update health profile
  async updateHealthProfile(profileData) {
    const response = await api.put('/profile/health', profileData);
    return response.data;
  },

  // Delete user account
  async deleteAccount() {
    const response = await api.delete('/auth/profile');
    return response.data;
  },
};

export default profileService;
