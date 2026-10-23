import { describe, expect, it } from 'vitest';
import { isProtectedStorageExportKey } from '@/platform/storage/protected-prefixes';

describe('delete-orphans protected keys', () => {
  it('filtra claves bajo payroll/audits aunque estén en la lista explícita', () => {
    const auditKey = 'organizations/org-1/payroll/audits/2026/10/report.pdf';
    const orphanKey = 'organizations/org-1/oficios/2026/10/old.pdf';
    const requested = [auditKey, orphanKey];

    const keysToDelete = requested.filter((key) => !isProtectedStorageExportKey(key));
    const rejected = requested.filter((key) => isProtectedStorageExportKey(key));

    expect(rejected).toEqual([auditKey]);
    expect(keysToDelete).toEqual([orphanKey]);
  });
});
