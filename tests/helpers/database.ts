import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';

const TEST_DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/sge_test';

export function isLiveDatabase(): boolean {
  return Boolean(process.env.SGE_LIVE_DB);
}

export function describeWithDatabase(name: string, fn: () => void | Promise<void>): void {
  if (!isLiveDatabase()) {
    describe.skip(name, () => {
      it.skip('requires SGE_LIVE_DB=true', () => {});
    });
    return;
  }
  describe(name, fn);
}

export async function pingDatabase(): Promise<boolean> {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export function withTestDatabase<T>(operation: () => Promise<T>): Promise<T> {
  if (!isLiveDatabase()) {
    throw new Error('Live database tests must opt in with SGE_LIVE_DB=true.');
  }
  return operation();
}

export function cleanupTestTenant(organizationId: string): Promise<number> {
  if (!isLiveDatabase()) {
    return Promise.resolve(0);
  }
  // The deletion order respects referential integrity. Tables without an
  // organizationId are kept (system audit events, sessions).
  return prisma.$transaction(async (tx) => {
    let count = 0;
    const modelsWithOrg = [
      'notification',
      'integrationExecution',
      'organizationIntegration',
      'auditRecord',
      'documentSequence',
      'replacementProjection',
      'compraOrden',
      'oficioDocument',
      'oficioTracking',
      'oficioImportBatchItem',
      'oficioImportBatch',
      'oficio',
      'ticket',
      'equipmentAssignment',
      'equipmentDisposalHistory',
      'disposalDocument',
      'equipmentDisposal',
      'disposalPolicy',
      'equipment',
      'costCenter',
      'proveedor',
      'compraOrdenTemplate',
      'audit',
      'department',
      'organizationMembership',
    ];
    for (const model of modelsWithOrg) {
      type Delegate = { deleteMany: (args: { where: { organizationId: string } }) => Promise<{ count: number }> };
      const delegate = (tx as unknown as Record<string, Delegate | undefined>)[model];
      if (!delegate) continue;
      const result = await delegate.deleteMany({ where: { organizationId } });
      count += result.count;
    }
    await tx.domainEventOutbox.deleteMany({ where: { organizationId } });
    await tx.systemAuditEvent.deleteMany({ where: { organizationId } });
    return count;
  });
}

export const TEST_ENV = Object.freeze({
  TEST_DATABASE_URL,
  SGE_LIVE_DB: process.env.SGE_LIVE_DB === 'true',
});

void TEST_ENV;
void afterAll;
void beforeAll;
void expect;
