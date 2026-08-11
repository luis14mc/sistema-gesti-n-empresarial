// Phase 10F — k6 load test for the report dashboard load.
//
// Run with:
//   k6 run tests/performance/k6/report-dashboard.js
//
// 5 VUs sustained for 60s. Report generation is heavy; the dashboard
// aggregator must respond under 1.5s p95.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 5,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(50)<500', 'p(95)<1500', 'p(99)<3000'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

export default function () {
  const response = http.get(`${BASE_URL}/api/reports/catalog`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  check(response, {
    'catalog loaded': (r) => r.status === 200,
  });
  const response2 = http.get(`${BASE_URL}/dashboard`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  check(response2, { 'dashboard rendered': (r) => r.status === 200 });
}
