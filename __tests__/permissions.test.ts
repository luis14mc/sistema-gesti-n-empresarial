import { describe, it, expect } from 'vitest';
import {
  canAccess,
  hasModuleAccess,
  getAccessibleModules,
  getModuleActions,
} from '../src/lib/permissions';

describe('RBAC — permissions matrix', () => {
  describe('ADMIN', () => {
    it('has full CRUD on oficios/equipment/assignments/users/audit-records', () => {
      expect(canAccess('ADMIN', 'oficios', 'delete')).toBe(true);
      expect(canAccess('ADMIN', 'equipment', 'delete')).toBe(true);
      expect(canAccess('ADMIN', 'assignments', 'update')).toBe(true);
      expect(canAccess('ADMIN', 'users', 'delete')).toBe(true);
      expect(canAccess('ADMIN', 'audit-records', 'delete')).toBe(true);
    });

    it('can update settings but not delete', () => {
      expect(canAccess('ADMIN', 'settings', 'update')).toBe(true);
      expect(canAccess('ADMIN', 'settings', 'delete')).toBe(false);
    });
  });

  describe('IT', () => {
    it('can manage equipment and assignments but not delete', () => {
      expect(canAccess('IT', 'equipment', 'create')).toBe(true);
      expect(canAccess('IT', 'equipment', 'update')).toBe(true);
      expect(canAccess('IT', 'equipment', 'delete')).toBe(false);
    });

    it('cannot access oficios or users', () => {
      expect(canAccess('IT', 'oficios', 'read')).toBe(false);
      expect(canAccess('IT', 'users', 'read')).toBe(false);
    });
  });

  describe('RRHH', () => {
    it('can manage users and read audit-records', () => {
      expect(canAccess('RRHH', 'users', 'update')).toBe(true);
      expect(canAccess('RRHH', 'audit-records', 'read')).toBe(true);
    });

    it('cannot manage equipment or assignments', () => {
      expect(canAccess('RRHH', 'equipment', 'create')).toBe(false);
    });
  });

  describe('USER (read-only baseline)', () => {
    it('can only read oficios/equipment/assignments and dashboard', () => {
      expect(canAccess('USER', 'dashboard', 'read')).toBe(true);
      expect(canAccess('USER', 'oficios', 'read')).toBe(true);
      expect(canAccess('USER', 'equipment', 'read')).toBe(true);
      expect(canAccess('USER', 'assignments', 'read')).toBe(true);
    });

    it('cannot create, update, or delete any resource', () => {
      expect(canAccess('USER', 'oficios', 'create')).toBe(false);
      expect(canAccess('USER', 'equipment', 'update')).toBe(false);
      expect(canAccess('USER', 'assignments', 'delete')).toBe(false);
    });

    it('cannot access users/purchases/audit-records', () => {
      expect(canAccess('USER', 'users', 'read')).toBe(false);
      expect(canAccess('USER', 'purchases', 'read')).toBe(false);
      expect(canAccess('USER', 'audit-records', 'read')).toBe(false);
    });
  });

  describe('Deprecation safety', () => {
    it('legacy modules (tickets/inventory/time-entries) are no longer in PERMISSIONS', () => {
      // @ts-expect-error - módulos legacy fueron removidos del type
      expect(canAccess('ADMIN', 'tickets', 'read')).toBe(false);
      // @ts-expect-error - módulos legacy fueron removidos del type
      expect(canAccess('ADMIN', 'inventory', 'read')).toBe(false);
      // @ts-expect-error - módulos legacy fueron removidos del type
      expect(canAccess('ADMIN', 'time-entries', 'read')).toBe(false);
    });
  });

  describe('Helpers', () => {
    it('hasModuleAccess returns true if any permission exists', () => {
      expect(hasModuleAccess('ADMIN', 'oficios')).toBe(true);
      expect(hasModuleAccess('USER', 'purchases')).toBe(false);
    });

    it('getAccessibleModules returns modules with at least one action', () => {
      const admin = getAccessibleModules('ADMIN');
      expect(admin).toContain('dashboard');
      expect(admin).toContain('oficios');
      expect(admin).not.toContain('tickets');
    });

    it('getModuleActions returns the actions list or empty array', () => {
      expect(getModuleActions('ADMIN', 'settings')).toEqual(['read', 'update']);
      expect(getModuleActions('USER', 'purchases')).toEqual([]);
    });
  });
});
