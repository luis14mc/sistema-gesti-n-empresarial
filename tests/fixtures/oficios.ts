let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString(36)}`;
}

export function resetOficioFactoryCounters(): void {
  counter = 0;
}

export type TestOficio = Readonly<{
  id: string;
  organizationId: string;
  number: string;
  systemNumber: string;
  type: 'INCOMING' | 'OUTGOING' | 'INTERNAL';
  subject: string;
  status: 'DRAFT' | 'SENT' | 'RECEIVED' | 'COMPLETED' | 'ARCHIVED' | 'CANCELLED';
  oficioDate: Date;
  institution: string;
  createdById: string;
  version: number;
}>;

export function createTestOffice(overrides: Partial<TestOficio> & { organizationId: string; createdById: string }): TestOficio {
  const id = overrides.id ?? nextId('ofc');
  return {
    id,
    organizationId: overrides.organizationId,
    number: overrides.number ?? `OFC-2026-${id.toUpperCase()}`,
    systemNumber: overrides.systemNumber ?? `S-${id.toUpperCase()}`,
    type: overrides.type ?? 'INCOMING',
    subject: overrides.subject ?? `Subject for ${id}`,
    status: overrides.status ?? 'DRAFT',
    oficioDate: overrides.oficioDate ?? new Date('2026-02-01T00:00:00Z'),
    institution: overrides.institution ?? 'Test Institution',
    createdById: overrides.createdById,
    version: overrides.version ?? 1,
  };
}
