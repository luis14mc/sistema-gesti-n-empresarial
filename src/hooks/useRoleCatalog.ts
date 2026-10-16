'use client';

import { useQuery } from '@tanstack/react-query';
import type { AssignableRoleOption } from '@/components/users/UserRoleSelect';

export type RoleLabelEntry = {
  role: string;
  displayName: string;
  assignable: boolean;
  label?: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const { readApiErrorFromResponse } = await import('@/lib/api-error-message');
    throw new Error(
      await readApiErrorFromResponse(res, 'Error al cargar roles', { rolesContext: true }),
    );
  }
  return res.json() as Promise<T>;
}

export function useAssignableRoles() {
  return useQuery({
    queryKey: ['roles', 'assignable'],
    queryFn: () =>
      fetchJson<{ roles: AssignableRoleOption[] }>('/api/roles?assignable=true').then(
        (data) => data.roles,
      ),
    staleTime: 60_000,
  });
}

export function useRoleLabels() {
  return useQuery({
    queryKey: ['roles', 'labels'],
    queryFn: () =>
      fetchJson<{ roles: RoleLabelEntry[] }>('/api/roles?scope=labels').then((data) => data.roles),
    staleTime: 60_000,
  });
}

export function useRoleCatalogAdmin() {
  return useQuery({
    queryKey: ['roles', 'admin'],
    queryFn: () => fetchJson<{ roles: RoleLabelEntry[] }>('/api/roles').then((data) => data.roles),
    staleTime: 30_000,
  });
}
