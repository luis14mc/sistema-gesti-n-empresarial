#!/usr/bin/env node
// Phase 11A — clean the synthetic dataset.
//
// Refuses to run without PERFORMANCE_TEST_MODE=true and a non-production
// DATABASE_URL. Deletes every row whose id starts with `perf-`.
import { PrismaClient } from '@prisma/client';

if (process.env.PERFORMANCE_TEST_MODE !== 'true') {
  console.error('REFUSED: set PERFORMANCE_TEST_MODE=true to clean the dataset.');
  process.exit(64);
}

const databaseUrl = process.env.DATABASE_URL ?? '';
if (/production|prod\./i.test(databaseUrl)) {
  console.error('REFUSED: DATABASE_URL looks like production.');
  process.exit(64);
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // Audit events first (largest table).
  const auditDeleted = await prisma.systemAuditEvent.deleteMany({
    where: { entityType: 'Perf' },
  });
  console.log(`Deleted audit rows: ${auditDeleted.count}`);

  const tables = [
    'compraOrden',
    'oficio',
    'equipment',
    'organizationMembership',
    'organization',
  ] as const;

  for (const table of tables) {
    const model = (prisma as unknown as Record<string, { deleteMany: (args: { where: { id: { startsWith: string } } }) => Promise<{ count: number }> }>)[table];
    if (!model) continue;
    const result = await model.deleteMany({ where: { id: { startsWith: 'perf-' } } });
    console.log(`Deleted ${table}: ${result.count}`);
  }

  const users = await prisma.user.deleteMany({ where: { id: { startsWith: 'perf-' } } });
  console.log(`Deleted users: ${users.count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
