import { describe, expect, it } from 'vitest';
import { reconcileStorageAudit } from '@/platform/storage/storage-audit';

describe('reconcileStorageAudit', () => {
  it('classifies orphan, missing, and duplicate-reference keys', () => {
    const rows = reconcileStorageAudit({
      appEnv: 'production',
      objects: [
        {
          key: 'organizations/org-a/oficios/2026/10/orphan.pdf',
          size: 100,
          lastModified: '2026-10-01T00:00:00.000Z',
          originalName: 'orphan.pdf',
        },
        {
          key: 'organizations/org-a/oficios/2026/10/shared.pdf',
          size: 50,
          lastModified: '2026-10-05T00:00:00.000Z',
        },
      ],
      references: [
        {
          entity: 'OficioDocument',
          id: 'doc-1',
          storageKey: 'organizations/org-a/oficios/2026/10/missing.pdf',
          createdAt: '2026-10-02T00:00:00.000Z',
        },
        {
          entity: 'OficioDocument',
          id: 'doc-2',
          storageKey: 'organizations/org-a/oficios/2026/10/shared.pdf',
          createdAt: '2026-10-03T00:00:00.000Z',
        },
        {
          entity: 'OficioDocument',
          id: 'doc-3',
          storageKey: 'organizations/org-a/oficios/2026/10/shared.pdf',
          createdAt: '2026-10-04T00:00:00.000Z',
        },
      ],
    });

    expect(rows.some((r) => r.section === 'HUERFANOS' && r.storageKey.includes('orphan.pdf'))).toBe(true);
    expect(rows.some((r) => r.section === 'FALTANTES' && r.storageKey.includes('missing.pdf'))).toBe(true);
    expect(rows.some((r) => r.section === 'POSIBLE_SOBRESCRITURA' && r.storageKey.includes('shared.pdf'))).toBe(
      true,
    );
  });
});
