'use client';

import { useQuery } from '@tanstack/react-query';

interface BandejaContador {
  count: number;
}

const BADGE_KEYS = {
  'compras-bandeja': '/api/compras/bandeja/contador',
} as const;

type BadgeKey = keyof typeof BADGE_KEYS;

async function fetchContador(endpoint: string): Promise<BandejaContador> {
  const res = await fetch(endpoint, { credentials: 'include' });
  if (!res.ok) return { count: 0 };
  return (await res.json()) as BandejaContador;
}

/**
 * Devuelve el contador para una clave de badge declarada en el Sidebar.
 * Solo se activa para claves conocidas; el resto retorna `{ count: 0 }`.
 */
export function useBandejaContador(badgeKey: string) {
  const endpoint = BADGE_KEYS[badgeKey as BadgeKey];

  return useQuery<BandejaContador>({
    queryKey: ['badge', badgeKey],
    queryFn: () => fetchContador(endpoint),
    enabled: Boolean(endpoint),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
