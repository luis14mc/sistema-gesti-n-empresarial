// Phase 10F — k6 load test for the document creation APIs.
//
// Run with:
//   k6 run tests/performance/k6/document-creation.js
//
// Target: 10 VUs sustained for 60s. The scenario asserts that the
// document creation endpoints stay under the approved p95 threshold.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 10,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(50)<600', 'p(95)<2000', 'p(99)<4000'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

export default function () {
  const payload = JSON.stringify({
    subject: `k6 oficios ${Date.now()}`,
    type: 'INCOMING',
    institution: 'k6 load test',
  });
  const response = http.post(`${BASE_URL}/api/oficios`, payload, {
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
    },
  });
  check(response, {
    '2xx': (r) => r.status >= 200 && r.status < 300,
    'envelope is success': (r) => {
      const body = r.json();
      return body && body.success === true;
    },
  });
}
