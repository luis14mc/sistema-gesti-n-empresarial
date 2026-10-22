import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config.js';

const ROOT = resolve(import.meta.dirname, '../..');

type RedirectRule = {
  source: string;
  destination: string;
  permanent?: boolean;
};

function destinationPagePath(destination: string): string {
  const normalized = destination.replace(/:path\*/g, '').replace(/\/+$/, '');
  if (normalized === '/activos/equipos' || normalized.startsWith('/activos/equipos/')) {
    return 'src/app/activos/equipos/page.tsx';
  }
  if (normalized === '/activos/asignaciones' || normalized.startsWith('/activos/asignaciones/')) {
    return 'src/app/activos/asignaciones/page.tsx';
  }
  if (normalized === '/activos/bajas') return 'src/app/activos/bajas/page.tsx';
  if (normalized === '/activos/licencias') return 'src/app/activos/licencias/page.tsx';
  if (normalized.startsWith('/activos/bajas/')) return 'src/app/activos/bajas/[id]/page.tsx';
  if (normalized.startsWith('/activos/licencias/') && normalized.endsWith('/editar')) {
    return 'src/app/activos/licencias/[id]/editar/page.tsx';
  }
  if (normalized === '/activos/licencias/nueva') return 'src/app/activos/licencias/nueva/page.tsx';
  if (normalized === '/activos/licencias/asignaciones') return 'src/app/activos/licencias/asignaciones/page.tsx';
  if (normalized.startsWith('/activos/licencias/')) return 'src/app/activos/licencias/[id]/page.tsx';
  throw new Error(`No page mapping for redirect destination: ${destination}`);
}

describe('activos URL redirects', () => {
  it('each legacy redirect targets an existing app page', async () => {
    const redirects = (await nextConfig.redirects?.()) as RedirectRule[];
    expect(redirects?.length).toBeGreaterThan(0);

    const rootRedirects = redirects.filter((r) => !r.source.includes(':path*'));
    for (const rule of rootRedirects) {
      expect(rule.permanent).toBe(false);
      const page = destinationPagePath(rule.destination);
      expect(existsSync(resolve(ROOT, page)), `${rule.source} → ${page}`).toBe(true);
    }

    const wildcardRedirects = redirects.filter((r) => r.source.includes(':path*'));
    for (const rule of wildcardRedirects) {
      expect(rule.permanent).toBe(false);
      const sampleDest = rule.destination.replace(':path*', 'sample-id');
      const page = destinationPagePath(sampleDest);
      expect(existsSync(resolve(ROOT, page)), `${rule.source} → ${page}`).toBe(true);
    }
  });
});
