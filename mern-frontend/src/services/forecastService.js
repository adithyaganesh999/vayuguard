// Forecast service for VayuGuard - handles forecast API calls
import api from './api';

export const forecastService = {
  // Get hourly forecast for a location
  async getHourlyForecast(locationId, hours = 72) {
    const response = await api.get(`/aqi/forecast?location=${locationId}&hours=${hours}`);
    return response.data;
  },

  // Get daily forecast for a location
  async getDailyForecast(locationId, days = 7) {
    const response = await api.get(`/aqi/forecast?location=${locationId}&days=${days}`);
    return response.data;
  },

  // Get forecast with confidence intervals
  async getForecastWithConfidence(locationId, confidence = 0.95) {
    const response = await api.get(`/aqi/forecast?location=${locationId}&confidence=${confidence}`);
    return response.data;
  },

  // Get current AQI for a location
  async getCurrentAQI(locationId) {
    const response = await api.get(`/aqi/current?location=${locationId}`);
    return response.data;
  },

  // Get multi-location forecast comparison
  async getMultiLocationForecast(locationIds) {
    const response = await api.post('/aqi/forecast/compare', { locations: locationIds });
    return response.data;
  },

  // Get pollutant-specific forecast
  async getPollutantForecast(locationId, pollutant = 'pm25') {
    const response = await api.get(`/aqi/forecast?location=${locationId}&pollutant=${pollutant}`);
    return response.data;
  },
};

export default forecastService;
