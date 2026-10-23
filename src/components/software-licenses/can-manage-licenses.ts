import type { User } from '@/types';

export function canManageSoftwareLicenses(user: User | null | undefined): boolean {
  return Boolean(user?.permissions?.includes('software-licenses.manage'));
}
