import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed:   ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  // Smoke test all services
  const endpoints = [
    `${BASE_URL}/health`,
    'http://localhost:3000',
    'http://localhost:8000/health',
  ];

  endpoints.forEach(url => {
    const res = http.get(url);
    check(res, {
      [`${url} is up`]: (r) => r.status < 500,
    });
  });
}