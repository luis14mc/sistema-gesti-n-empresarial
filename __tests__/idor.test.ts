import { describe, it, expect } from 'vitest';
import { applyIdorFilter, checkItemAccess } from '../src/lib/idor';

describe('IDOR helper — applyIdorFilter', () => {
  it('ADMIN bypasses IDOR (gets the base where)', () => {
    const base = { isActive: true };
    const result = applyIdorFilter(base, {
      role: 'ADMIN', userId: 'admin-1', userAccess: 'none',
    });
    expect(result).toEqual({ isActive: true });
  });

  it('USER con userAccess=none no ve NADA', () => {
    const base = { isActive: true };
    const result = applyIdorFilter(base, {
      role: 'USER', userId: 'u-1', userAccess: 'none',
    });
    expect(result).toMatchObject({ id: '__never__' });
  });

  it('USER con userAccess=self-record filtra por userId', () => {
    const base = { isActive: true };
    const result = applyIdorFilter(base, {
      role: 'USER', userId: 'u-1', userAccess: 'self-record',
    });
    expect(result).toMatchObject({ isActive: true, userId: 'u-1' });
  });

  it('USER con userAccess=owner filtra por createdById', () => {
    const base = {};
    const result = applyIdorFilter(base, {
      role: 'USER', userId: 'u-7', userAccess: 'owner',
    });
    expect(result).toMatchObject({ createdById: 'u-7' });
  });

  it('USER con userAccess=assigned crea un OR combinando userId/assignedUserId/employee', () => {
    const base = {};
    const result = applyIdorFilter(base, {
      role: 'USER', userId: 'u-3', userAccess: 'assigned',
    }) as { OR: unknown[] };
    expect(Array.isArray(result.OR)).toBe(true);
    expect(result.OR.length).toBeGreaterThan(0);
  });

  it('IT/RRHH sin extraForStaff pasan el base', () => {
    const base = { isActive: true };
    const resultIT = applyIdorFilter(base, {
      role: 'IT', userId: 'it-1', userAccess: 'none',
    });
    expect(resultIT).toEqual({ isActive: true });

    const resultRRHH = applyIdorFilter(base, {
      role: 'RRHH', userId: 'rh-1', userAccess: 'none',
    });
    expect(resultRRHH).toEqual({ isActive: true });
  });

  it('extraForStaff aplica filtros a roles no-ADMIN', () => {
    const base = { isActive: true };
    const result = applyIdorFilter(base, {
      role: 'RRHH', userId: 'rh-1', userAccess: 'none',
      extraForStaff: {
        ADMIN: undefined,
        USER:  undefined,
        IT:    undefined,
        RRHH:  { departmentId: 'dept-1' },
      },
    });
    expect(result).toMatchObject({ isActive: true, departmentId: 'dept-1' });
  });
});

describe('IDOR helper — checkItemAccess', () => {
  it('null/undefined items nunca pasan', () => {
    expect(checkItemAccess(null,  { role: 'ADMIN', userId: 'a', userAccess: 'none' })).toBe(false);
    expect(checkItemAccess(undefined, { role: 'ADMIN', userId: 'a', userAccess: 'none' })).toBe(false);
  });

  it('ADMIN pasa siempre', () => {
    const item = { id: 'x', userId: 'other' };
    expect(checkItemAccess(item, { role: 'ADMIN', userId: 'a', userAccess: 'owner' })).toBe(true);
  });

  it('USER en self-record solo pasa si userId coincide', () => {
    const own  = { id: '1', userId: 'u-1' };
    const other = { id: '2', userId: 'u-2' };
    expect(checkItemAccess(own,  { role: 'USER', userId: 'u-1', userAccess: 'self-record' })).toBe(true);
    expect(checkItemAccess(other, { role: 'USER', userId: 'u-1', userAccess: 'self-record' })).toBe(false);
  });

  it('USER en owner pasa si createdById o userId o employee.userId coinciden', () => {
    const own    = { id: '1', createdById: 'u-1' };
    const own2   = { id: '2', userId: 'u-1' };
    const own3   = { id: '3', employee: { userId: 'u-1' } };
    const other  = { id: '4', userId: 'u-2' };
    const opts = { role: 'USER' as const, userId: 'u-1', userAccess: 'owner' as const };
    expect(checkItemAccess(own,   opts)).toBe(true);
    expect(checkItemAccess(own2,  opts)).toBe(true);
    expect(checkItemAccess(own3,  opts)).toBe(true);
    expect(checkItemAccess(other, opts)).toBe(false);
  });

  it('customCheck tiene prioridad', () => {
    const item = { id: 'x' };
    const opts = {
      role: 'USER' as const,
      userId: 'u-1',
      userAccess: 'none' as const,
      customCheck: (it: Record<string, unknown>) => it.id === 'x',
    };
    expect(checkItemAccess(item, opts)).toBe(true);
  });
});
