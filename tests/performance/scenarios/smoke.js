// Phase 11A — k6 smoke scenario.
//
// 1–5 VUs for 30 seconds. Used as the "is the system still alive?"
// check before any nightly run.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(50)<500', 'p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.005'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

export default function () {
  const response = http.get(`${BASE_URL}/api/health/live`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  check(response, { 'liveness OK': (r) => r.status === 200 });
  const response2 = http.get(`${BASE_URL}/api/health/ready`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  check(response2, { 'readiness OK': (r) => r.status === 200 || r.status === 503 });
}
