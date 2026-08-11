import { describe, expect, it } from 'vitest';
import { apiFailure, apiSuccess } from '@/platform/api/response';
import { ConcurrentModificationError } from '@/platform/domain/errors';
import { expectFailureEnvelope, expectRequestIdHeader, expectSafeEnvelope, expectSuccessEnvelope } from '../helpers/contracts';

describe('API success envelope (Phase 10A contract)', () => {
  it('matches the documented success shape', async () => {
    const response = apiSuccess({ hello: 'world' }, { requestId: 'req-success-1', status: 200 });
    expect(response.status).toBe(200);
    expectRequestIdHeader(response.headers, 'req-success-1');
    const body = await response.json();
    expectSuccessEnvelope(body, { requestId: 'req-success-1', data: { hello: 'world' } });
  });

  it('does not expose an error field on success', async () => {
    const response = apiSuccess({ ok: true }, { requestId: 'req-success-2' });
    const body = await response.json();
    expect(body).not.toHaveProperty('error');
  });

  it('always sets the x-request-id header', async () => {
    const response = apiSuccess(null, { requestId: 'req-success-3' });
    expect(response.headers.get('x-request-id')).toBe('req-success-3');
  });
});

describe('API failure envelope (Phase 10A contract)', () => {
  it('matches the documented failure shape with a known error code', async () => {
    const response = apiFailure('CONCURRENT_MODIFICATION', 'La operación entró en conflicto.', {
      requestId: 'req-failure-1',
      status: 409,
      stage: 'RESOLVE',
    });
    expect(response.status).toBe(409);
    expectRequestIdHeader(response.headers, 'req-failure-1');
    const body = await response.json();
    expectFailureEnvelope(body, {
      requestId: 'req-failure-1',
      code: 'CONCURRENT_MODIFICATION',
      message: /conflicto/i,
      stage: 'RESOLVE',
    });
  });

  it('omits details and stage when not provided', async () => {
    const response = apiFailure('INTERNAL_ERROR', 'fallo interno', { requestId: 'req-failure-2', status: 500 });
    const body = await response.json();
    expectFailureEnvelope(body, { requestId: 'req-failure-2', code: 'INTERNAL_ERROR' });
    expect(body.error).not.toHaveProperty('details');
    expect(body.error).not.toHaveProperty('stage');
  });

  it('always sets the x-request-id header on failure', async () => {
    const response = apiFailure('FOO', 'bar', { requestId: 'req-failure-3', status: 422 });
    expect(response.headers.get('x-request-id')).toBe('req-failure-3');
  });

  it('forwards details when explicitly provided', async () => {
    const response = apiFailure('INVALID_DOMAIN_DATA', 'invalid', {
      requestId: 'req-failure-4',
      status: 422,
      details: { field: 'quantity' },
    });
    const body = await response.json();
    expectFailureEnvelope(body, { requestId: 'req-failure-4', code: 'INVALID_DOMAIN_DATA' });
    expect(body.error.details).toEqual({ field: 'quantity' });
  });
});

describe('Failure envelope leak guard (Phase 10A contract)', () => {
  it('never echoes the original error message when it contains a secret keyword', async () => {
    const response = apiFailure('INTERNAL_ERROR', 'Authorization bearer token leaked: abcdef', {
      requestId: 'req-leak-1',
      status: 500,
    });
    const body = await response.json();
    expectSafeEnvelope(body, ['authorization', 'token']);
  });

  it('preserves the human-friendly message that does not contain secrets', async () => {
    const response = apiFailure('CONCURRENT_MODIFICATION', 'Conflicto de versión', {
      requestId: 'req-leak-2',
      status: 409,
    });
    const body = await response.json();
    expect(body.error.message).toContain('Conflicto');
  });
});

describe('DomainError mapping (Phase 10A contract)', () => {
  it('ConcurrentModificationError renders with code CONCURRENT_MODIFICATION and status 409', () => {
    const error = new ConcurrentModificationError({ field: 'version' });
    expect(error.code).toBe('CONCURRENT_MODIFICATION');
    expect(error.httpStatus).toBe(409);
    expect(error.details).toEqual({ field: 'version' });
  });
});
