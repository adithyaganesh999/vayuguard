import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m',  target: 50 },   // Stay at 50 users
    { duration: '30s', target: 100 },  // Spike to 100 users
    { duration: '1m',  target: 50 },   // Scale down to 50
    { duration: '30s', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% requests under 2s
    http_req_failed:   ['rate<0.01'],  // Less than 1% failure
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  // Test 1: Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status 200': (r) => r.status === 200,
    'health check fast':       (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Test 2: Frontend
  const frontendRes = http.get('http://localhost:3000');
  check(frontendRes, {
    'frontend status 200': (r) => r.status === 200,
  });

  sleep(1);

  // Test 3: API endpoint
  const apiRes = http.get(`${BASE_URL}/api/v1/status`);
  check(apiRes, {
    'api status 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);

  // Test 4: ML service
  const mlRes = http.get('http://localhost:8000/health');
  check(mlRes, {
    'ml service status 200': (r) => r.status === 200,
  });

  sleep(1);
}