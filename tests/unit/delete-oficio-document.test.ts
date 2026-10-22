import { beforeEach, describe, expect, it, vi } from 'vitest';

const removeStoredDocument = vi.fn().mockResolvedValue(undefined);
const deleteOficioDocumentRecord = vi.fn();

vi.mock('@/modules/oficios/infrastructure/oficio-repository', () => ({
  deleteOficioDocumentRecord,
}));

vi.mock('@/modules/purchases/infrastructure/purchase-order-document-access', () => ({
  removeStoredDocument,
}));

vi.mock('@/platform/security/audit/audit-record', () => ({
  createAuditRecord: vi.fn().mockResolvedValue(undefined),
}));

describe('deleteOficioDocumentUseCase', () => {
  beforeEach(() => {
    removeStoredDocument.mockClear();
    deleteOficioDocumentRecord.mockReset();
  });

  it('calls storage.remove after the database transaction', async () => {
    deleteOficioDocumentRecord.mockResolvedValue({
      id: 'doc-1',
      storageKey: 'organizations/org/oficios/2026/10/uuid-memo.pdf',
      originalName: 'memo.pdf',
    });

    const { deleteOficioDocumentUseCase } = await import(
      '@/modules/oficios/application/delete-oficio-document'
    );

    await deleteOficioDocumentUseCase({
      organizationId: 'org',
      actorUserId: 'user-1',
      oficioId: 'oficio-1',
      documentId: 'doc-1',
    });

    expect(deleteOficioDocumentRecord.mock.invocationCallOrder[0]).toBeLessThan(
      removeStoredDocument.mock.invocationCallOrder[0]!,
    );
    expect(removeStoredDocument).toHaveBeenCalledWith(
      'organizations/org/oficios/2026/10/uuid-memo.pdf',
    );
  });
});
