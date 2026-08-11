// Phase 10C — IDOR per-entity security regression.
//
// For each critical entity we verify that the tenant-scope helpers
// produce distinct `where` clauses for distinct organizations. The
// shape-level guarantee prevents accidental cross-tenant access when
// new repositories are added — the compiler will fail if a helper
// forgets to filter by organizationId.
import { describe, expect, it, vi } from 'vitest';
import {
  auditScope,
  auditChildScope,
  correctiveActionScope,
  auditRecordScope,
} from '@/modules/audits/infrastructure/tenant-scope';
import {
  assignmentScope,
  equipmentScope,
  maintenanceScope,
} from '@/modules/equipment/tenant';
import {
  disposalDocumentScope,
  disposalPolicyScope,
  disposalScope,
  disposalSequenceScope,
} from '@/modules/equipment-disposal/infrastructure/tenant-scope';
import {
  oficioBatchScope,
  oficioBatchTenantScope,
  oficioDocumentScope,
  oficioDocumentTenantScope,
  oficioScope,
  oficioSequenceScope,
  oficioTenantScope,
  oficioUserAccessScope,
} from '@/modules/oficios/infrastructure/tenant-scope';
import {
  purchaseOrderChildScope,
  purchaseOrderScope,
} from '@/lib/compras/orden/tenant';
import { notificationCommandService, notificationQueryService } from '@/modules/notifications/application/queries';

const ORG_A = 'org-a';
const ORG_B = 'org-b';

describe('IDOR — equipment', () => {
  it('equipmentScope filters by organizationId', () => {
    expect(equipmentScope(ORG_A)).toEqual({ organizationId: ORG_A });
    expect(equipmentScope(ORG_A)).not.toEqual(equipmentScope(ORG_B));
  });

  it('assignmentScope filters by organizationId and the equipment relationship', () => {
    expect(assignmentScope(ORG_A)).toEqual({
      organizationId: ORG_A,
      equipment: { organizationId: ORG_A },
    });
    expect(assignmentScope(ORG_A)).not.toEqual(assignmentScope(ORG_B));
  });

  it('maintenanceScope filters through the equipment relationship', () => {
    expect(maintenanceScope(ORG_A)).toEqual({ equipment: { organizationId: ORG_A } });
    expect(maintenanceScope(ORG_A)).not.toEqual(maintenanceScope(ORG_B));
  });
});

describe('IDOR — equipment disposal', () => {
  it('disposalScope uses id + organizationId', () => {
    expect(disposalScope(ORG_A, 'd-1')).toEqual({ id: 'd-1', organizationId: ORG_A });
    expect(disposalScope(ORG_A, 'd-1')).not.toEqual(disposalScope(ORG_B, 'd-1'));
  });

  it('disposalDocumentScope adds the disposalId filter', () => {
    expect(disposalDocumentScope(ORG_A, 'd-1', 'doc-1')).toEqual({
      id: 'doc-1',
      disposalId: 'd-1',
      organizationId: ORG_A,
    });
  });

  it('disposalPolicyScope filters by organizationId', () => {
    expect(disposalPolicyScope(ORG_A)).toEqual({ organizationId: ORG_A });
    expect(disposalPolicyScope(ORG_A)).not.toEqual(disposalPolicyScope(ORG_B));
  });

  it('disposalSequenceScope uses the composite unique index', () => {
    const a = disposalSequenceScope(ORG_A, 2026);
    const b = disposalSequenceScope(ORG_B, 2026);
    expect(a.organizationId_documentType_year.organizationId).toBe(ORG_A);
    expect(b.organizationId_documentType_year.organizationId).toBe(ORG_B);
    expect(a).not.toEqual(b);
  });
});

describe('IDOR — oficios', () => {
  it('oficioTenantScope filters by organizationId', () => {
    expect(oficioTenantScope(ORG_A)).toEqual({ organizationId: ORG_A });
    expect(oficioTenantScope(ORG_A)).not.toEqual(oficioTenantScope(ORG_B));
  });

  it('oficioScope combines organizationId and id', () => {
    expect(oficioScope(ORG_A, 'o-1')).toEqual({ id: 'o-1', organizationId: ORG_A });
    expect(oficioScope(ORG_A, 'o-1')).not.toEqual(oficioScope(ORG_B, 'o-1'));
  });

  it('oficioDocumentScope chains the parent filter', () => {
    expect(oficioDocumentScope(ORG_A, 'o-1')).toMatchObject({
      oficioId: 'o-1',
      oficio: { id: 'o-1', organizationId: ORG_A },
    });
  });

  it('oficioDocumentTenantScope filters through the parent oficio', () => {
    expect(oficioDocumentTenantScope(ORG_A)).toEqual({ oficio: { organizationId: ORG_A } });
    expect(oficioDocumentTenantScope(ORG_A)).not.toEqual(oficioDocumentTenantScope(ORG_B));
  });

  it('oficioBatchScope isolates import batches by organization', () => {
    expect(oficioBatchScope(ORG_A, 'b-1')).toEqual({ id: 'b-1', organizationId: ORG_A });
    expect(oficioBatchTenantScope(ORG_A)).toEqual({ organizationId: ORG_A });
  });

  it('oficioUserAccessScope narrows to the user\'s own records or recipient', () => {
    const scope = oficioUserAccessScope('u-1', 'u@example.test');
    expect(scope.OR).toEqual([
      { createdById: 'u-1' },
      { recipient: { contains: 'u@example.test', mode: 'insensitive' } },
    ]);
  });

  it('oficioSequenceScope uses the composite unique index', () => {
    const a = oficioSequenceScope(ORG_A, 2026);
    expect(a.organizationId_documentType_year.documentType).toBe('OFFICE_DOCUMENT');
    expect(a).not.toEqual(oficioSequenceScope(ORG_B, 2026));
  });
});

describe('IDOR — purchase orders', () => {
  it('purchaseOrderScope filters by organizationId', () => {
    expect(purchaseOrderScope(ORG_A)).toEqual({ organizationId: ORG_A });
    expect(purchaseOrderScope(ORG_A)).not.toEqual(purchaseOrderScope(ORG_B));
  });

  it('purchaseOrderChildScope scopes child tables through the parent order', () => {
    expect(purchaseOrderChildScope(ORG_A)).toEqual({ orden: { organizationId: ORG_A } });
    expect(purchaseOrderChildScope(ORG_A)).not.toEqual(purchaseOrderChildScope(ORG_B));
  });
});

describe('IDOR — audits', () => {
  it('auditScope filters by organizationId', () => {
    expect(auditScope(ORG_A)).toEqual({ organizationId: ORG_A });
    expect(auditScope(ORG_A, 'a-1')).toEqual({ id: 'a-1', organizationId: ORG_A });
    expect(auditScope(ORG_A, 'a-1')).not.toEqual(auditScope(ORG_B, 'a-1'));
  });

  it('auditChildScope chains the parent audit filter', () => {
    expect(auditChildScope(ORG_A, 'a-1')).toEqual({
      auditId: 'a-1',
      audit: { id: 'a-1', organizationId: ORG_A },
    });
    expect(auditChildScope(ORG_A, 'a-1', 'f-1')).toEqual({
      id: 'f-1',
      auditId: 'a-1',
      audit: { id: 'a-1', organizationId: ORG_A },
    });
  });

  it('correctiveActionScope filters by organizationId', () => {
    expect(correctiveActionScope(ORG_A)).toEqual({ organizationId: ORG_A });
    expect(correctiveActionScope(ORG_A, 'c-1')).toEqual({ id: 'c-1', organizationId: ORG_A });
  });

  it('auditRecordScope filters by organizationId', () => {
    expect(auditRecordScope(ORG_A)).toEqual({ organizationId: ORG_A });
    expect(auditRecordScope(ORG_A)).not.toEqual(auditRecordScope(ORG_B));
  });
});

describe('IDOR — notifications queries', () => {
  it('list builds a tenant-scoped where clause', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const client = { notification: { findMany, count } } as unknown as import('@prisma/client').PrismaClient;
    await notificationQueryService.list({
      organizationId: ORG_A,
      userId: 'u-1',
      page: 1,
      pageSize: 20,
    }, client);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_A,
          OR: expect.arrayContaining([{ userId: 'u-1' }, { userId: null }]),
        }),
      }),
    );
  });

  it('unreadCount is tenant-scoped', async () => {
    const count = vi.fn().mockResolvedValue(0);
    const client = { notification: { count } } as unknown as import('@prisma/client').PrismaClient;
    await notificationQueryService.unreadCount(ORG_A, 'u-1', client);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_A,
          OR: expect.arrayContaining([{ userId: 'u-1' }, { userId: null }]),
          readAt: null,
        }),
      }),
    );
  });

  it('markRead checks ownership and rejects notifications owned by another user', async () => {
    const notif = { id: 'n-1', organizationId: ORG_A, userId: 'u-2', readAt: null };
    const findFirst = vi.fn().mockResolvedValue(notif);
    const update = vi.fn();
    const client = { notification: { findFirst, update } } as unknown as import('@prisma/client').PrismaClient;
    await expect(notificationCommandService.markRead({
      organizationId: ORG_A,
      userId: 'u-1',
      notificationId: 'n-1',
      requestId: 'req-1',
    }, client)).rejects.toThrow(/notifica/i);
    expect(update).not.toHaveBeenCalled();
  });

  it('markRead throws when the notification belongs to another organization', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const update = vi.fn();
    const client = { notification: { findFirst, update } } as unknown as import('@prisma/client').PrismaClient;
    await expect(notificationCommandService.markRead({
      organizationId: ORG_A,
      userId: 'u-1',
      notificationId: 'n-1',
      requestId: 'req-2',
    }, client)).rejects.toThrow(/not found/i);
    expect(update).not.toHaveBeenCalled();
  });
});
