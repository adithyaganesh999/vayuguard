/**
 * Standardized API response helpers for VayuGuard backend.
 */
class ApiResponse {
  /**
   * Success response
   */
  static success(res, data = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Created response (201)
   */
  static created(res, data = null, message = 'Resource created successfully') {
    return ApiResponse.success(res, data, message, 201);
  }

  /**
   * No content response (204)
   */
  static noContent(res) {
    return res.status(204).send();
  }

  /**
   * Error response
   */
  static error(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
    };
    if (errors) {
      response.errors = errors;
    }
    return res.status(statusCode).json(response);
  }

  /**
   * Bad request (400)
   */
  static badRequest(res, message = 'Bad Request', errors = null) {
    return ApiResponse.error(res, message, 400, errors);
  }

  /**
   * Unauthorized (401)
   */
  static unauthorized(res, message = 'Unauthorized') {
    return ApiResponse.error(res, message, 401);
  }

  /**
   * Forbidden (403)
   */
  static forbidden(res, message = 'Forbidden') {
    return ApiResponse.error(res, message, 403);
  }

  /**
   * Not found (404)
   */
  static notFound(res, message = 'Resource not found') {
    return ApiResponse.error(res, message, 404);
  }

  /**
   * Conflict (409)
   */
  static conflict(res, message = 'Resource already exists') {
    return ApiResponse.error(res, message, 409);
  }

  /**
   * Too many requests (429)
   */
  static tooManyRequests(res, message = 'Too many requests, please try again later') {
    return ApiResponse.error(res, message, 429);
  }

  /**
   * Service unavailable (503)
   */
  static serviceUnavailable(res, message = 'Service temporarily unavailable') {
    return ApiResponse.error(res, message, 503);
  }

  /**
   * Paginated list response
   */
  static paginated(res, data, page, limit, total, message = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = ApiResponse;
