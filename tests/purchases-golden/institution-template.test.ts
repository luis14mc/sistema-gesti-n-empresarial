import { describe, expect, it, vi } from 'vitest';
import { sanitizeLogoCandidate } from '@/modules/purchases/infrastructure/institution';
import { DEFAULT_INSTITUTION_SETTINGS, getInstitutionSettings } from '@/modules/purchases/infrastructure/institution-store';
import fixture from './__fixtures__/institution-template.json';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    compraOrdenTemplate: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock('@/platform/integrations/application/ssrf-guard', () => ({
  checkUrlForSsrf: vi.fn((url: string) => {
    if (url.includes('cdn.example.com')) return { ok: true };
    return { ok: false, reason: 'blocked' };
  }),
}));

describe('purchases golden — institución y plantilla', () => {
  it('DEFAULT_INSTITUTION_SETTINGS incluye nombre y logoPath', () => {
    expect(DEFAULT_INSTITUTION_SETTINGS.name).toBeTruthy();
    expect(DEFAULT_INSTITUTION_SETTINGS.logoPath).toBe(fixture.defaultSettings.logoPath);
  });

  it('getInstitutionSettings devuelve defaults si no hay plantilla activa', async () => {
    const settings = await getInstitutionSettings('org-golden-default');
    expect(settings.name).toBeTruthy();
    expect(settings.logoPath).toBeTruthy();
  });

  it('sanitizeLogoCandidate: aceptados y rechazados (SSRF / raster policy)', () => {
    const s = fixture.sanitizeLogo;
    expect(sanitizeLogoCandidate(s.acceptedHttps)).toBe(s.acceptedHttps);
    expect(sanitizeLogoCandidate(s.acceptedDataUri)).toBe(s.acceptedDataUri);
    expect(sanitizeLogoCandidate(s.rejectedHttp)).toBeNull();
    expect(sanitizeLogoCandidate(s.rejectedLocalhost)).toBeNull();
    expect(sanitizeLogoCandidate(s.rejectedSvgData)).toBeNull();
    expect(sanitizeLogoCandidate(s.rejectedTraversal)).toBeNull();
    expect(sanitizeLogoCandidate(s.rejectedPrivatePath)).toBeNull();
  });

  it('mensajes API logo institucional documentados', () => {
    expect(fixture.logoUpload.maxSizeMessage).toBe('El logo no puede superar 2 MB.');
    expect(fixture.logoUpload.missingFileMessage).toBe('Archivo requerido');
    expect(fixture.logoUpload.adminOnlyMessage).toBe('Solo administradores pueden editar');
  });
});
