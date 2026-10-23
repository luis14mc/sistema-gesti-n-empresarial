import type { User } from '@/types';
import { canAccess } from '@/platform/security/session-module-access';

export function canDeleteEmployee(user: User | null | undefined): boolean {
  if (!user?.role) return false;
  if (!canAccess(user.role, 'employees', 'update')) return false;
  return user.role === 'ADMIN' || user.role === 'OWNER';
}
