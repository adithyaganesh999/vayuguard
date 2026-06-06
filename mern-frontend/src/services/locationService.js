// Location service for VayuGuard - handles location API calls
import api from './api';

export const locationService = {
  // Search for locations (geocoding)
  async searchLocations(query) {
    const response = await api.get(`/aqi/current?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // Get location by coordinates (reverse geocoding)
  async getLocationByCoords(latitude, longitude) {
    const response = await api.get(`/aqi/current?lat=${latitude}&lon=${longitude}`);
    return response.data;
  },

  // Get nearby monitoring stations
  async getNearbyStations(latitude, longitude, radius = 50) {
    const response = await api.get(`/aqi/current?lat=${latitude}&lon=${longitude}&radius=${radius}`);
    return response.data;
  },

  // Get all supported cities
  async getCities() {
    const response = await api.get('/aqi/current');
    return response.data;
  },

  // Get popular cities with AQI data
  async getPopularCities() {
    const response = await api.get('/aqi/current?popular=true');
    return response.data;
  },

  // Get location details
  async getLocationDetails(locationId) {
    const response = await api.get(`/aqi/current?location=${locationId}`);
    return response.data;
  },
};

export default locationService;
