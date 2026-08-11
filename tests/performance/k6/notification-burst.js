// Phase 10F — k6 load test for the notification burst scenario.
//
// Run with:
//   k6 run tests/performance/k6/notification-burst.js
//
// 20 VUs sustained for 60s. The dispatcher is expected to dedupe and
// to attribute every notification to the right tenant.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 20,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(50)<200', 'p(95)<800', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

export default function () {
  const payload = JSON.stringify({
    eventType: 'organization.lifecycle.suspended',
    organizationId: 'org-load-1',
    actorUserId: 'user-load-1',
    requestId: `k6-${Date.now()}-${__VU}`,
  });
  const response = http.post(`${BASE_URL}/api/notifications/dispatch`, payload, {
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
    },
  });
  check(response, {
    '2xx': (r) => r.status >= 200 && r.status < 300,
  });
}
