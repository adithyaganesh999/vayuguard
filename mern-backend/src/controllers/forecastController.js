const ApiResponse = require('../utils/apiResponse');
const { getForecast, getHistorical } = require('../services/mlClient');
const logger = require('../utils/logger');

/**
 * GET /api/forecast/:city
 * Proxy forecast request to the ML FastAPI service
 */
const getCityForecast = async (req, res, next) => {
  try {
    const { city } = req.params;

    logger.info(`[Forecast] Request for city: ${city}`);

    const forecast = await getForecast(city);

    return ApiResponse.success(res, forecast, `Forecast for ${city}`);
  } catch (error) {
    if (error.response) {
      // ML service returned an error
      const status = error.response.status;
      const message = error.response.data?.detail || error.response.data?.message || 'ML service error';

      if (status === 404) {
        return ApiResponse.notFound(res, `Forecast not available for city: ${req.params.city}`);
      }
      if (status === 422) {
        return ApiResponse.badRequest(res, `Invalid city name: ${req.params.city}`);
      }

      logger.error(`[Forecast] ML service error (${status}): ${message}`);
      return ApiResponse.serviceUnavailable(res, 'Forecast service temporarily unavailable');
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      logger.error(`[Forecast] ML service unreachable: ${error.message}`);
      return ApiResponse.serviceUnavailable(res, 'Forecast service is currently unavailable');
    }

    next(error);
  }
};

/**
 * GET /api/forecast/historical/:city
 * Proxy historical data request to the ML FastAPI service
 */
const getCityHistorical = async (req, res, next) => {
  try {
    const { city } = req.params;
    const days = req.query.days || 30;

    logger.info(`[Forecast] Historical request for city: ${city}, days: ${days}`);

    const historical = await getHistorical(city, parseInt(days, 10));

    return ApiResponse.success(res, historical, `Historical data for ${city}`);
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.detail || error.response.data?.message || 'ML service error';

      if (status === 404) {
        return ApiResponse.notFound(res, `Historical data not available for city: ${req.params.city}`);
      }

      logger.error(`[Forecast] ML service error (${status}): ${message}`);
      return ApiResponse.serviceUnavailable(res, 'Forecast service temporarily unavailable');
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      logger.error(`[Forecast] ML service unreachable: ${error.message}`);
      return ApiResponse.serviceUnavailable(res, 'Forecast service is currently unavailable');
    }

    next(error);
  }
};

module.exports = { getCityForecast, getCityHistorical };
