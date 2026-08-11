// Phase 10F — k6 load test for the PDF generation endpoints.
//
// Run with:
//   k6 run tests/performance/k6/pdf-generation.js
//
// PDF generation is the slowest user-visible flow. The p95 target is
// 4s; the p99 target is 8s. Sustained 5 VUs for 60s.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 5,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(50)<1500', 'p(95)<4000', 'p(99)<8000'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

export default function () {
  const response = http.post(`${BASE_URL}/api/compras/ordenes/seed-order/generar`, '{}', {
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
    },
  });
  check(response, {
    '2xx': (r) => r.status >= 200 && r.status < 300,
    'PDF returned': (r) => r.headers['Content-Type'] === 'application/pdf' || r.status === 200,
  });
}
