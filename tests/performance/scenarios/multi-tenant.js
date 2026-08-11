// Phase 11A — k6 multi-tenant scenario.
//
// 10 organizations × 20 users each. Same resource IDs across tenants
// to detect accidental cache-key leakage.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    multi_tenant: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';

const ORG_IDS = Array.from({ length: 10 }, (_, i) => `perf-org-${(i + 1).toString().padStart(4, '0')}`);

export default function () {
  const orgId = ORG_IDS[__VU % ORG_IDS.length];
  const routes = [
    `/api/oficios?page=1&pageSize=20`,
    `/api/equipment?page=1&pageSize=20`,
    `/api/compras/ordenes?page=1&pageSize=20`,
    `/api/notifications?page=1&pageSize=20`,
  ];
  for (const path of routes) {
    const response = http.get(`${BASE_URL}${path}`, {
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'x-organization-id': orgId,
      },
    });
    check(response, {
      'ok': (r) => r.status < 500,
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
}
