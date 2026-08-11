// Phase 10F — k6 load test for the read APIs.
//
// Run with:
//   k6 run tests/performance/k6/list-reads.js
//
// This scenario exercises the list endpoints under sustained load. The
// returned percentiles are compared against the approved baselines in
// tests/performance/baselines.json.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 25,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(50)<200', 'p(95)<800', 'p(99)<1500'],
    http_req_failed: ['rate<0.005'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

const ROUTES = [
  '/api/oficios',
  '/api/equipment',
  '/api/compras/ordenes',
  '/api/notifications',
  '/api/reports/catalog',
];

export default function () {
  for (const route of ROUTES) {
    const response = http.get(`${BASE_URL}${route}`, {
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    check(response, {
      '200 OK': (r) => r.status === 200,
      'envelope is success': (r) => {
        const body = r.json();
        return body && body.success === true;
      },
    });
  }
}
