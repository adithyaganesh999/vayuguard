// Auth service for VayuGuard - handles authentication API calls
import api from './api';

export const authService = {
  // Login with email and password
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    if (response.data?.id) {
      // Store session
      const user = {
        id: response.data.id,
        email: response.data.email,
        name: response.data.name,
        location: response.data.location,
        token: response.data.token,
      };
      localStorage.setItem('vayuguard_session', JSON.stringify(user));
    }
    return response.data;
  },

  // Register a new user
  async signup(name, email, password, phone, location) {
    const response = await api.post('/auth/register', {
      name,
      email,
      password,
      phone,
      location,
    });
    if (response.data?.id) {
      const user = {
        id: response.data.id,
        email: response.data.email,
        name: response.data.name,
        token: response.data.token,
      };
      localStorage.setItem('vayuguard_session', JSON.stringify(user));
    }
    return response.data;
  },

  // Logout
  logout() {
    localStorage.removeItem('vayuguard_session');
  },

  // Get current user session
  getCurrentUser() {
    try {
      const session = localStorage.getItem('vayuguard_session');
      return session ? JSON.parse(session) : null;
    } catch {
      return null;
    }
  },

  // Check if authenticated
  isAuthenticated() {
    return !!this.getCurrentUser();
  },

  // Update user profile
  async updateProfile(updates) {
    const response = await api.patch('/auth/profile', updates);
    // Update local session
    const current = this.getCurrentUser();
    if (current) {
      const updated = { ...current, ...updates };
      localStorage.setItem('vayuguard_session', JSON.stringify(updated));
    }
    return response.data;
  },

  // Change password
  async changePassword(currentPassword, newPassword) {
    const response = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  // Request password reset
  async requestPasswordReset(email) {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  // Reset password with token
  async resetPassword(token, newPassword) {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },
};

export default authService;
