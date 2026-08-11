let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

export function resetEquipmentFactoryCounters(): void {
  counter = 0;
}

export type TestEquipment = Readonly<{
  id: string;
  organizationId: string;
  assetCode: string;
  description: string;
  brand: string;
  model: string;
  serialNumber: string;
  status: 'AVAILABLE' | 'ASSIGNED' | 'IN_MAINTENANCE' | 'DISPOSED' | 'RETIRED';
  purchaseDate: Date;
  purchasePrice: number;
  createdById: string;
}>;

export function createTestEquipment(overrides: Partial<TestEquipment> & { organizationId: string; createdById: string }): TestEquipment {
  const id = overrides.id ?? nextId('eq');
  return {
    id,
    organizationId: overrides.organizationId,
    assetCode: overrides.assetCode ?? `EQ-${id.toUpperCase()}`,
    description: overrides.description ?? `Equipment ${id}`,
    brand: overrides.brand ?? 'TestBrand',
    model: overrides.model ?? 'TestModel',
    serialNumber: overrides.serialNumber ?? `SN-${id.toUpperCase()}`,
    status: overrides.status ?? 'AVAILABLE',
    purchaseDate: overrides.purchaseDate ?? new Date('2025-01-15T00:00:00Z'),
    purchasePrice: overrides.purchasePrice ?? 1500,
    createdById: overrides.createdById,
  };
}
