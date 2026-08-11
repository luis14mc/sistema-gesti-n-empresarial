// Phase 11A — k6 stress scenario.
//
// Ramps VUs until degradation. The first bottleneck is recorded in
// the report. The script intentionally does not abort on threshold
// breach — it must continue to record the failure point.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 25 },
    { duration: '2m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 400 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
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
  '/api/audit-logs',
];

export default function () {
  const path = ROUTES[Math.floor(Math.random() * ROUTES.length)];
  const response = http.get(`${BASE_URL}${path}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  check(response, { 'ok': (r) => r.status < 500 });
}
