// Phase 11A — k6 soak scenario.
//
// 25 VUs sustained for 60 minutes. Reveals memory / connection /
// file leaks.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 25,
  duration: '60m',
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

const ROUTES = [
  '/api/oficios',
  '/api/equipment',
  '/api/compras/ordenes',
  '/api/notifications',
  '/api/audit-logs',
];

export default function () {
  const path = ROUTES[Math.floor(Math.random() * ROUTES.length)];
  const response = http.get(`${BASE_URL}${path}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  check(response, { 'ok': (r) => r.status < 500 });
}
