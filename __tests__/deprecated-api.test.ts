import { describe, it, expect } from 'vitest';
import {
  DEPRECATED_API_MESSAGES,
  DEPRECATED_FRONTEND_PREFIXES,
  isDeprecatedFrontendPath,
} from '../src/lib/deprecated-api';

describe('deprecated API modules', () => {
  it('define mensajes 410 para módulos fuera de alcance', () => {
    expect(DEPRECATED_API_MESSAGES.tickets).toContain('/api/tickets');
    expect(DEPRECATED_API_MESSAGES.timeEntries).toContain('/api/time-entries');
    expect(DEPRECATED_API_MESSAGES.promotionalItems).toContain('/api/promotional-items');
    expect(DEPRECATED_API_MESSAGES.purchases).toContain('/api/compras/solicitudes');
  });

  it('detecta rutas frontend legacy', () => {
    expect(isDeprecatedFrontendPath('/tickets')).toBe(true);
    expect(isDeprecatedFrontendPath('/tickets/abc')).toBe(true);
    expect(isDeprecatedFrontendPath('/inventory')).toBe(true);
    expect(isDeprecatedFrontendPath('/time-entries')).toBe(true);
    expect(isDeprecatedFrontendPath('/compras')).toBe(false);
    expect(isDeprecatedFrontendPath('/dashboard')).toBe(false);
  });

  it('lista prefijos frontend deprecados', () => {
    expect(DEPRECATED_FRONTEND_PREFIXES).toEqual([
      '/tickets',
      '/inventory',
      '/time-entries',
    ]);
  });
});
