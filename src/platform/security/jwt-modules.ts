import type { ModuleId } from '@/platform/security/modules';

/** Edge-safe module id list (keep in sync with MODULE_IDS). */
const MODULE_ID_SET = new Set<string>([
  'dashboard',
  'oficios',
  'equipment',
  'assignments',
  'employees',
  'users',
  'purchases',
  'audits',
  'audit-records',
  'reports',
  'settings',
  'software-licenses',
  'payroll',
]);

export function encodeModulesForJwt(moduleIds: readonly ModuleId[]): string {
  return moduleIds.join(',');
}

export function decodeModulesFromJwt(encoded: string | undefined): Set<ModuleId> {
  if (!encoded) return new Set();
  return new Set(
    encoded
      .split(',')
      .filter((m) => MODULE_ID_SET.has(m))
      .map((m) => m as ModuleId),
  );
}
