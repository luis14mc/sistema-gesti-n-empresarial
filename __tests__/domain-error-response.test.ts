import { describe, expect, it } from 'vitest';
import { ConcurrentModificationError } from '@/platform/domain/errors';
import { domainErrorResponse } from '@/platform/api/domain-error-response';

describe('domain error response', () => {
  it('maps typed domain errors to the standardized API envelope', async () => {
    const response = domainErrorResponse(new ConcurrentModificationError({ expectedVersion: 1 }), 'req-1');
    expect(response.status).toBe(409);
    expect(response.headers.get('x-request-id')).toBe('req-1');
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { code: 'CONCURRENT_MODIFICATION', details: { expectedVersion: 1 } },
      requestId: 'req-1',
    });
  });

  it('does not expose unknown internal error messages', async () => {
    const response = domainErrorResponse(new Error('database password leaked'), 'req-2');
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('database password leaked');
  });
});
