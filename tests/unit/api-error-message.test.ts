import { describe, expect, it } from 'vitest';
import {
  extractApiErrorMessage,
  formatRolesApiErrorMessage,
  parseApiErrorPayload,
} from '@/lib/api-error-message';

describe('api-error-message', () => {
  it('parses apiFailure envelope', () => {
    const parsed = parseApiErrorPayload({
      success: false,
      requestId: 'req-1',
      error: { code: 'PERMISSION_DENIED', message: 'No permitido' },
    });
    expect(parsed.message).toBe('No permitido');
    expect(parsed.requestId).toBe('req-1');
  });

  it('does not stringify error object as [object Object]', () => {
    const message = formatRolesApiErrorMessage(403, {
      success: false,
      error: { code: 'PERMISSION_DENIED', message: 'No permitido' },
    }, 'fallback');
    expect(message).not.toContain('[object Object]');
    expect(message).toContain('roles.manage');
  });

  it('maps 500 with requestId for support', () => {
    const message = formatRolesApiErrorMessage(
      500,
      { requestId: 'abc-123', error: { message: 'Internal' } },
      'fallback',
    );
    expect(message).toContain('Error del servidor');
    expect(message).toContain('abc-123');
  });

  it('extractApiErrorMessage handles plain string error', () => {
    expect(extractApiErrorMessage({ error: 'Texto plano' }, 'fb')).toBe('Texto plano');
  });
});
