import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { SYNC_EXPORT_ROW_LIMIT } from '@/platform/reporting/export';
import { ReportExportTooLargeError } from '@/modules/reporting/domain/export-errors';
import { buildPurchaseOrderSummaryExportDataset } from '@/modules/reporting/infrastructure/exports/purchase-order-summary-export';
import { buildEquipmentInventoryExportDataset } from '@/modules/reporting/infrastructure/exports/equipment-inventory-export';
import { buildOfficeRegisterExportDataset } from '@/modules/reporting/infrastructure/exports/office-register-export';
import { buildEquipmentAssignmentHistoryExportDataset } from '@/modules/reporting/infrastructure/exports/equipment-assignment-history-export';
import { buildEquipmentDisposalSummaryExportDataset } from '@/modules/reporting/infrastructure/exports/equipment-disposal-summary-export';

const baseParams = {
  organizationId: 'org-a',
  organizationName: 'CNI',
  from: '2026-01-01',
  to: '2026-01-31',
};

describe('report datasets (lib/reportes)', () => {
  it('PURCHASE_ORDER_SUMMARY scopes tenant, filters dates and totals', async () => {
    const count = vi.fn(async () => 1);
    const findMany = vi.fn(async () => [{
      orderNumber: 'OC-1',
      requestDate: new Date('2026-01-10'),
      status: 'ISSUED',
      supplierName: 'Acme',
      supplierRtn: '0801',
      subtotal: 100,
      discount: 0,
      tax: 15,
      total: 115,
    }]);
    const prisma = { compraOrden: { count, findMany } } as unknown as PrismaClient;

    const dataset = await buildPurchaseOrderSummaryExportDataset({ prisma, ...baseParams });
    expect(count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ organizationId: 'org-a', deletedAt: null }),
    }));
    expect(dataset.summary?.total).toBe(115);
    expect(dataset.rows).toHaveLength(1);
  });

  it('PURCHASE_ORDER_SUMMARY throws when row limit exceeded', async () => {
    const prisma = {
      compraOrden: { count: vi.fn(async () => SYNC_EXPORT_ROW_LIMIT + 1) },
    } as unknown as PrismaClient;
    await expect(buildPurchaseOrderSummaryExportDataset({ prisma, ...baseParams }))
      .rejects.toBeInstanceOf(ReportExportTooLargeError);
  });

  it('EQUIPMENT_INVENTORY applies category and status filters', async () => {
    const count = vi.fn(async () => 1);
    const findMany = vi.fn(async () => [{
      inventoryCode: 'EQ-1',
      category: 'LAPTOP',
      brand: 'Dell',
      model: 'X',
      serialNumber: 'SN',
      status: 'AVAILABLE',
      purchaseDate: new Date('2026-01-05'),
      assignments: [],
    }]);
    const prisma = { equipment: { count, findMany } } as unknown as PrismaClient;

    await buildEquipmentInventoryExportDataset({
      prisma,
      ...baseParams,
      filters: { status: 'AVAILABLE', category: 'LAPTOP' },
    });

    expect(count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org-a',
        status: 'AVAILABLE',
        category: 'LAPTOP',
      }),
    }));
  });

  it('OFFICE_REGISTER filters by organization and oficio date', async () => {
    const count = vi.fn(async () => 1);
    const findMany = vi.fn(async () => [{
      number: 'OF-1',
      type: 'INCOMING',
      oficioDate: new Date('2026-01-03'),
      senderName: 'Ext',
      preparedBy: null,
      recipientName: 'CNI',
      recipient: null,
      subject: 'Test',
      status: 'DRAFT',
      scope: 'CNI',
    }]);
    const prisma = { oficio: { count, findMany } } as unknown as PrismaClient;

    const dataset = await buildOfficeRegisterExportDataset({
      prisma,
      ...baseParams,
      filters: { type: 'INCOMING' },
    });
    expect(dataset.rows[0]?.type).toBeTruthy();
    expect(count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-a' }) }));
  });

  it('EQUIPMENT_ASSIGNMENT_HISTORY returns assignment rows', async () => {
    const count = vi.fn(async () => 1);
    const findMany = vi.fn(async () => [{
      assignedDate: new Date('2026-01-02'),
      returnedDate: null,
      status: 'ACTIVE',
      employeeNameSnapshot: 'Ana',
      employeeNameAtTime: null,
      departmentSnapshot: 'TI',
      departmentAtTime: null,
      equipment: { inventoryCode: 'EQ-9' },
    }]);
    const prisma = { equipmentAssignment: { count, findMany } } as unknown as PrismaClient;

    const dataset = await buildEquipmentAssignmentHistoryExportDataset({ prisma, ...baseParams });
    expect(dataset.rows[0]?.employeeName).toBe('Ana');
  });

  it('EQUIPMENT_DISPOSAL_SUMMARY includes approver and requester', async () => {
    const count = vi.fn(async () => 1);
    const findMany = vi.fn(async () => [{
      status: 'APPROVED',
      disposalResult: 'DISPOSAL_JUSTIFIED',
      submittedAt: new Date('2026-01-04'),
      approvedAt: new Date('2026-01-05'),
      createdAt: new Date('2026-01-03'),
      equipment: { inventoryCode: 'EQ-2' },
      evaluatedBy: { firstName: 'Luis', lastName: 'M', email: 'a@cni.hn' },
      approvedBy: { firstName: 'Dir', lastName: 'X', email: 'd@cni.hn' },
    }]);
    const prisma = { equipmentDisposal: { count, findMany } } as unknown as PrismaClient;

    const dataset = await buildEquipmentDisposalSummaryExportDataset({ prisma, ...baseParams });
    expect(dataset.rows[0]?.requestedBy).toContain('Luis');
    expect(dataset.summary).toBeTruthy();
  });
});
