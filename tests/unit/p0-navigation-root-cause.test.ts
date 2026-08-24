import { describe, expect, it } from 'vitest';
import { canAccess } from '@/lib/permissions';

describe('P0 shared authorization invariants', () => {
  it('keeps the legacy ADMIN functional baseline allowed', () => {
    expect(canAccess('ADMIN', 'oficios', 'create')).toBe(true);
    expect(canAccess('ADMIN', 'purchases', 'create')).toBe(true);
    expect(canAccess('ADMIN', 'employees', 'read')).toBe(true);
    expect(canAccess('ADMIN', 'users', 'read')).toBe(true);
  });

  it('does not turn an unauthorized role into an allow-all role', () => {
    expect(canAccess('USER', 'employees', 'create')).toBe(false);
    expect(canAccess('USER', 'users', 'read')).toBe(false);
  });
});
