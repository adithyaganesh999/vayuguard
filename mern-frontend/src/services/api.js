// Axios-like API instance with interceptors for VayuGuard
// Uses native fetch with wrapper for consistent API handling

const API_BASE_URL = typeof window !== 'undefined'
  ? (window.__ENV__?.REACT_APP_API_URL || '/api')
  : '/api';

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.interceptors = {
      request: [],
      response: [],
    };
  }

  // Add request interceptor
  addRequestInterceptor(fn) {
    this.interceptors.request.push(fn);
    return () => {
      this.interceptors.request = this.interceptors.request.filter((f) => f !== fn);
    };
  }

  // Add response interceptor
  addResponseInterceptor(fn) {
    this.interceptors.response.push(fn);
    return () => {
      this.interceptors.response = this.interceptors.response.filter((f) => f !== fn);
    };
  }

  // Apply request interceptors
  async applyRequestInterceptors(config) {
    let modifiedConfig = { ...config };
    for (const interceptor of this.interceptors.request) {
      modifiedConfig = await interceptor(modifiedConfig);
    }
    return modifiedConfig;
  }

  // Apply response interceptors
  async applyResponseInterceptors(response) {
    let modifiedResponse = response;
    for (const interceptor of this.interceptors.response) {
      modifiedResponse = await interceptor(modifiedResponse);
    }
    return modifiedResponse;
  }

  // Get auth token
  getAuthToken() {
    if (typeof window === 'undefined') return null;
    try {
      const session = localStorage.getItem('vayuguard_session');
      if (session) {
        const user = JSON.parse(session);
        return user?.token || null;
      }
    } catch {}
    return null;
  }

  // Build request config
  async buildConfig(method, data, customConfig = {}) {
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...customConfig.headers,
      },
      ...customConfig,
    };

    // Add auth token
    const token = this.getAuthToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Add body for non-GET requests
    if (data && method !== 'GET') {
      config.body = JSON.stringify(data);
    }

    return this.applyRequestInterceptors(config);
  }

  // Main request method
  async request(endpoint, method = 'GET', data = null, config = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const requestConfig = await this.buildConfig(method, data, config);

    try {
      const response = await fetch(url, requestConfig);
      const responseData = await response.json().catch(() => null);

      const result = {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: response.headers,
      };

      const interceptedResult = await this.applyResponseInterceptors(result);

      if (!response.ok) {
        const error = new Error(responseData?.error || responseData?.message || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.data = responseData;
        throw error;
      }

      return interceptedResult;
    } catch (error) {
      if (!error.status) {
        error.message = 'Network error. Please check your connection.';
      }
      throw error;
    }
  }

  // Convenience methods
  get(endpoint, config) {
    return this.request(endpoint, 'GET', null, config);
  }

  post(endpoint, data, config) {
    return this.request(endpoint, 'POST', data, config);
  }

  put(endpoint, data, config) {
    return this.request(endpoint, 'PUT', data, config);
  }

  patch(endpoint, data, config) {
    return this.request(endpoint, 'PATCH', data, config);
  }

  delete(endpoint, config) {
    return this.request(endpoint, 'DELETE', null, config);
  }
}

// Create and export the API instance
const api = new ApiClient(API_BASE_URL);

// Add default response interceptor for auth errors
api.addResponseInterceptor((response) => {
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vayuguard_session');
      // Redirect to login if not already there
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/';
      }
    }
  }
  return response;
});

export default api;
export { ApiClient };
