// Phase 10F — k6 load test for the webhook burst scenario.
//
// Run with:
//   k6 run tests/performance/k6/webhook-burst.js
//
// 30 VUs sustained for 60s. The webhook endpoint is read-only and
// idempotent; the load test must not mutate state.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 30,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(50)<300', 'p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const HOOK_PATH = __ENV.WEBHOOK_PATH || '/api/integrations/webhooks/seed-hook';

export default function () {
  const response = http.post(`${BASE_URL}${HOOK_PATH}`, '{}', {
    headers: { 'content-type': 'application/json' },
  });
  check(response, {
    'webhook accepted': (r) => r.status === 200 || r.status === 401,
  });
}
