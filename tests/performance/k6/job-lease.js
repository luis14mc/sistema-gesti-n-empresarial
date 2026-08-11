// Phase 10F — k6 load test for the job lease scenario.
//
// Run with:
//   k6 run tests/performance/k6/job-lease.js
//
// 10 VUs sustained for 60s. Workers call this endpoint to claim the
// next job. The endpoint must remain under 300ms p95 even at load.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(50)<150', 'p(95)<300', 'p(99)<600'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

export default function () {
  const response = http.post(`${BASE_URL}/api/jobs/lease`, '{}', {
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
    },
  });
  check(response, {
    'lease succeeded': (r) => r.status === 200 || r.status === 204,
  });
}
