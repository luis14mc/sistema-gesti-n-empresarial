// Phase 11A — k6 concurrent PDF generation.
//
// Generates PDFs in parallel and measures throughput / latency.
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    pdf_burst: {
      executor: 'constant-arrival-rate',
      rate: 5,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 10,
      maxVUs: 30,
    },
  },
  thresholds: {
    http_req_duration: ['p(50)<5000', 'p(95)<12000', 'p(99)<20000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || '';
const ORDER_ID = __ENV.ORDER_ID || 'perf-po-1';

export default function () {
  const response = http.post(`${BASE_URL}/api/compras/ordenes/${ORDER_ID}/generar`, '{}', {
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
    },
  });
  check(response, { 'pdf generated': (r) => r.status >= 200 && r.status < 500 });
}
