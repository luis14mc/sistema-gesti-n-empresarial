import { describe, it, expect } from 'vitest';
import {
  canAccess,
  hasModuleAccess,
  getAccessibleModules,
  getModuleActions,
  routeToAccess,
  canAccessRoute,
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

  describe('routeToAccess (URL → module + roles)', () => {
    it('resolves /dashboard to module dashboard (null = any role)', () => {
      const access = routeToAccess('/dashboard');
      expect(access?.module).toBe('dashboard');
      expect(access?.roles).toBeNull();
    });

    it('resolves /oficios/sub-routes to the oficios module', () => {
      const access = routeToAccess('/oficios/cni');
      expect(access?.module).toBe('oficios');
      expect(access?.roles).toBeNull();
    });

    it('resolves /equipment to any authenticated role (read-only)', () => {
      const access = routeToAccess('/equipment');
      expect(access?.module).toBe('equipment');
      expect(access?.roles).toBeNull();
    });

    it('resolves legacy /audit-records AND new /audit/logs to audit-records module', () => {
      expect(routeToAccess('/audit-records')?.module).toBe('audit-records');
      expect(routeToAccess('/audit/logs')?.module).toBe('audit-records');
      expect(routeToAccess('/audit/logs')?.roles).toEqual(['ADMIN']);
    });

    it('returns null for unprotected routes', () => {
      expect(routeToAccess('/login')).toBeNull();
      expect(routeToAccess('/some/unknown/path')).toBeNull();
    });
  });

  describe('canAccessRoute (role can navigate to path)', () => {
    it('ADMIN can access any module path', () => {
      expect(canAccessRoute('ADMIN', '/dashboard')).toBe(true);
      expect(canAccessRoute('ADMIN', '/equipment')).toBe(true);
      expect(canAccessRoute('ADMIN', '/settings')).toBe(true);
      expect(canAccessRoute('ADMIN', '/audit/logs')).toBe(true);
    });

    it('USER can only access dashboard and read-only oficios/equipment/assignments', () => {
      expect(canAccessRoute('USER', '/dashboard')).toBe(true);
      expect(canAccessRoute('USER', '/oficios')).toBe(true);
      expect(canAccessRoute('USER', '/oficios/cni')).toBe(true);
      expect(canAccessRoute('USER', '/equipment')).toBe(true);
      expect(canAccessRoute('USER', '/settings')).toBe(false);
      expect(canAccessRoute('USER', '/audit/logs')).toBe(false);
    });

    it('IT cannot access /users or /settings', () => {
      expect(canAccessRoute('IT', '/users')).toBe(false);
      expect(canAccessRoute('IT', '/settings')).toBe(false);
    });

    it('RRHH can access employees/users/purchases and view equipment (read)', () => {
      expect(canAccessRoute('RRHH', '/employees')).toBe(true);
      expect(canAccessRoute('RRHH', '/users')).toBe(true);
      expect(canAccessRoute('RRHH', '/purchases')).toBe(true);
      // RRHH no tiene módulo equipment en PERMISSIONS → sidebar lo oculta,
      // pero el middleware es permisivo. La acción final la decide API+UI.
      expect(canAccessRoute('RRHH', '/equipment')).toBe(true);
    });
  });
});
