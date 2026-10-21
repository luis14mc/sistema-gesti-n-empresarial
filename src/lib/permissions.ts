/**
 * @deprecated Fase 2b ADR-003 — import from `@/platform/security/session-module-access`
 * and `@/platform/security/session-route-navigation` instead.
 */
export type { Module, Action } from '@/platform/security/session-module-access';

export {
  canAccess,
  hasModuleAccess,
  getAccessibleModules,
  getModuleActions,
  ROUTE_ACCESS_BY_MODULE,
} from '@/platform/security/session-module-access';

export {
  ROUTE_PATH_TO_MODULE,
  routeToAccess,
  canAccessRoute,
} from '@/platform/security/session-route-navigation';
