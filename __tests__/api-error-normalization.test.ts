import { AxiosError } from 'axios';
import { describe, expect, it } from 'vitest';
import { getApiError } from '@/lib/api-error';

describe('getApiError', () => {
  it('normalizes the standardized API envelope', () => {
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      data: { error: { code: 'TENANT_ACCESS_DENIED', message: 'Acceso denegado', details: { resource: 'order' }, stage: 'authorization' }, requestId: 'req-1' },
      status: 403,
      statusText: 'Forbidden',
      headers: {},
      config: {} as never,
    });
    expect(getApiError(error)).toEqual({
      code: 'TENANT_ACCESS_DENIED',
      message: 'Acceso denegado',
      details: { resource: 'order' },
      stage: 'authorization',
      requestId: 'req-1',
      status: 403,
    });
  });

  it('maps machine codes to friendly Spanish messages', () => {
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      data: { error: 'DOCUMENT_NOT_FOUND' }, status: 404, statusText: 'Not Found', headers: {}, config: {} as never,
    });
    expect(getApiError(error).message).toBe('El documento solicitado no existe.');
  });
});
