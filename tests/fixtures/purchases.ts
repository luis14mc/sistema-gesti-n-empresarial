let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

export function resetPurchaseFactoryCounters(): void {
  counter = 0;
}

export type TestPurchaseOrder = Readonly<{
  id: string;
  organizationId: string;
  orderNumber: string;
  status: 'DRAFT' | 'GENERATED' | 'ISSUED' | 'CANCELLED' | 'CLOSED';
  supplierId: string;
  justification: string;
  issuedAt: Date | null;
  createdById: string;
  total: number;
  version: number;
}>;

export function createTestPurchaseOrderDraft(overrides: Partial<TestPurchaseOrder> & {
  organizationId: string;
  supplierId: string;
  createdById: string;
}): TestPurchaseOrder {
  const id = overrides.id ?? nextId('po');
  return {
    id,
    organizationId: overrides.organizationId,
    orderNumber: overrides.orderNumber ?? `OC-2026-${id.toUpperCase()}`,
    status: overrides.status ?? 'DRAFT',
    supplierId: overrides.supplierId,
    justification: overrides.justification ?? `Justification for ${id}`,
    issuedAt: overrides.issuedAt ?? null,
    createdById: overrides.createdById,
    total: overrides.total ?? 12500,
    version: overrides.version ?? 1,
  };
}
