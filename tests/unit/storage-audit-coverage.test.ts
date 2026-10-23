import { describe, expect, it } from 'vitest';
import { isProtectedStorageExportKey } from '@/platform/storage/protected-prefixes';
import { reconcileStorageAudit } from '@/platform/storage/storage-audit';

describe('storage audit coverage', () => {
  it('CompraOrdenTemplate.logoUrl referenciada no clasifica el objeto como huérfano', () => {
    const logoKey = 'organizations/org-1/compras/institution/logo.png';
    const rows = reconcileStorageAudit({
      objects: [
        {
          key: logoKey,
          size: 2048,
          lastModified: '2026-10-01T00:00:00.000Z',
        },
      ],
      references: [
        {
          entity: 'CompraOrdenTemplate.logo',
          id: 'tpl-1',
          storageKey: logoKey,
          createdAt: '2026-09-01T00:00:00.000Z',
        },
      ],
    });

    expect(rows.some((row) => row.section === 'HUERFANOS' && row.storageKey === logoKey)).toBe(false);
    expect(rows.some((row) => row.section === 'FALTANTES')).toBe(false);
  });

  it('objeto bajo payroll/audits se clasifica como EXPORTACIÓN, no huérfano', () => {
    const auditKey = 'organizations/org-1/payroll/audits/2026/10/export.pdf';
    const rows = reconcileStorageAudit({
      objects: [
        {
          key: auditKey,
          size: 5000,
          lastModified: '2026-10-10T00:00:00.000Z',
        },
      ],
      references: [],
    });

    expect(rows.some((row) => row.section === 'EXPORTACION' && row.storageKey === auditKey)).toBe(true);
    expect(rows.some((row) => row.section === 'HUERFANOS' && row.storageKey === auditKey)).toBe(false);
    expect(isProtectedStorageExportKey(auditKey)).toBe(true);
  });
});
