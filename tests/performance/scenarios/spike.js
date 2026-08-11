// Phase 11A — k6 spike scenario.
//
// 50 → 500 VUs in 10 seconds. Verifies autoscaling / rate-limiting
// recovery.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },
    { duration: '10s', target: 500 },
    { duration: '30s', target: 500 },
    { duration: '10s', target: 50 },
    { duration: '30s', target: 50 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.10'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

export default function () {
  const response = http.get(`${BASE_URL}/api/oficios`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  check(response, { 'ok': (r) => r.status < 500 });
}
