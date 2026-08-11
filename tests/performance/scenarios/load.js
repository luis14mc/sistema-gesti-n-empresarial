// Phase 11A — k6 load scenario.
//
// Realistic traffic mix from Phase 11 §62. Sustained load matching
// the expected baseline. Replace the route list with the actual mix
// once the seed dataset is in place.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 25,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(50)<500', 'p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.005'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';
const ORG_ID = __ENV.ORG_ID || 'perf-org-0001';

const ROUTES = [
  { path: '/api/oficios', weight: 35 },
  { path: '/api/equipment', weight: 20 },
  { path: '/api/compras/ordenes', weight: 10 },
  { path: '/api/notifications', weight: 10 },
  { path: '/api/reports/catalog', weight: 5 },
  { path: '/api/audit-logs', weight: 5 },
  { path: '/api/organizations/current', weight: 5 },
  { path: '/api/health/ready', weight: 10 },
];

function pickRoute() {
  const total = ROUTES.reduce((sum, r) => sum + r.weight, 0);
  const target = Math.random() * total;
  let acc = 0;
  for (const route of ROUTES) {
    acc += route.weight;
    if (target <= acc) return route;
  }
  return ROUTES[0];
}

export default function () {
  const route = pickRoute();
  const response = http.get(`${BASE_URL}${route.path}`, {
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'x-organization-id': ORG_ID,
    },
  });
  check(response, {
    'ok': (r) => r.status >= 200 && r.status < 500,
    'envelope success': (r) => {
      try {
        const body = r.json();
        return body && body.success === true;
      } catch {
        return false;
      }
    },
  });
}
