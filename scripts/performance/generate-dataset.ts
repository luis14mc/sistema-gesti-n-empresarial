#!/usr/bin/env node
// Phase 11A — synthetic dataset generator.
//
// Usage:
//   PERFORMANCE_TEST_MODE=true DATABASE_URL=… \
//     tsx scripts/performance/generate-dataset.ts --profile small
//
// Profiles:
//   small  — 5 orgs, 100 users, 1k equipment, 2k oficios, 1k POs, 5k audit
//   medium — 25 orgs, 1k users, 25k equipment, 50k oficios, 20k POs, 500k audit
//   large  — 100 orgs, 5k users, 250k equipment, 500k oficios, 200k POs, 5M audit
//
// Safety:
//   - Requires PERFORMANCE_TEST_MODE=true
//   - Refuses any DATABASE_URL that looks like production
//   - Reports estimated insert count and asks for confirmation when
//     the count exceeds 100k rows
//
// The script is idempotent: deleting the dataset first requires
// `scripts/performance/clean-dataset.ts`.

import { PrismaClient } from '@prisma/client';
import { createHash, randomInt, randomUUID } from 'node:crypto';

if (process.env.PERFORMANCE_TEST_MODE !== 'true') {
  console.error('REFUSED: set PERFORMANCE_TEST_MODE=true to use the dataset generator.');
  process.exit(64);
}

const databaseUrl = process.env.DATABASE_URL ?? '';
if (/production|prod\./i.test(databaseUrl)) {
  console.error('REFUSED: DATABASE_URL looks like production.');
  process.exit(64);
}

type Profile = 'small' | 'medium' | 'large';

const PROFILES: Record<Profile, Readonly<{
  organizations: number;
  users: number;
  equipment: number;
  oficios: number;
  purchaseOrders: number;
  auditEvents: number;
}>> = Object.freeze({
  small: { organizations: 5, users: 100, equipment: 1_000, oficios: 2_000, purchaseOrders: 1_000, auditEvents: 5_000 },
  medium: { organizations: 25, users: 1_000, equipment: 25_000, oficios: 50_000, purchaseOrders: 20_000, auditEvents: 500_000 },
  large: { organizations: 100, users: 5_000, equipment: 250_000, oficios: 500_000, purchaseOrders: 200_000, auditEvents: 5_000_000 },
});

const profile = (process.argv.find((a) => a.startsWith('--profile='))?.split('=')[1] ?? 'small') as Profile;
if (!(profile in PROFILES)) {
  console.error(`Unknown profile: ${profile}. Use small, medium, or large.`);
  process.exit(64);
}

const sizes = PROFILES[profile];
const totalRows
  = sizes.organizations
  + sizes.users
  + sizes.equipment
  + sizes.oficios
  + sizes.purchaseOrders
  + sizes.auditEvents;

console.log(`Profile: ${profile}`);
console.log(`Total rows (estimated): ${totalRows.toLocaleString()}`);
if (totalRows > 100_000 && !process.argv.includes('--yes')) {
  console.log('Pass --yes to confirm generation of this large dataset.');
  process.exit(66);
}

const prisma = new PrismaClient();

const deterministicId = (prefix: string, n: number): string => {
  const hash = createHash('sha256').update(`${prefix}|${n}`).digest('hex').slice(0, 20);
  return `${prefix}-${hash}`;
};

async function main(): Promise<void> {
  console.log('Seeding organizations…');
  const organizationIds: string[] = [];
  for (let i = 0; i < sizes.organizations; i += 1) {
    const id = deterministicId('perf-org', i);
    organizationIds.push(id);
    await prisma.organization.upsert({
      where: { id },
      update: {},
      create: {
        id,
        name: `Perf Org ${i + 1}`,
        slug: `perf-org-${i + 1}`,
        status: 'ACTIVE',
        onboardingStatus: 'COMPLETED',
        timezone: 'America/Tegucigalpa',
        locale: 'es-HN',
        currency: 'HNL',
        primaryContactEmail: `contact-${i + 1}@perf.example.test`,
      },
    });
  }

  console.log('Seeding users…');
  const userIds: string[] = [];
  for (let i = 0; i < sizes.users; i += 1) {
    const id = deterministicId('perf-user', i);
    const orgId = organizationIds[i % organizationIds.length]!;
    userIds.push(id);
    await prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email: `${id}@perf.example.test`,
        employeeNumber: `EMP-${i.toString().padStart(6, '0')}`,
        firstName: 'Perf',
        lastName: `User ${i + 1}`,
        isActive: true,
        role: 'USER',
        password: 'PerfPassword!23',
      },
    });
    await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: orgId, userId: id } },
      update: {},
      create: {
        organizationId: orgId,
        userId: id,
        role: 'USER',
        status: 'ACTIVE',
      },
    });
  }

  console.log('Seeding equipment…');
  for (let i = 0; i < sizes.equipment; i += 1) {
    const orgId = organizationIds[i % organizationIds.length]!;
    const createdById = userIds[i % userIds.length]!;
    await prisma.equipment.upsert({
      where: { id: deterministicId('perf-eq', i) },
      update: {},
      create: {
        id: deterministicId('perf-eq', i),
        organizationId: orgId,
        inventoryCode: `TI-PERF-${i.toString().padStart(6, '0')}`,
        type: 'LAPTOP',
        brand: 'PerfBrand',
        model: `Model-${i + 1}`,
        category: 'LAPTOP',
        status: 'AVAILABLE',
        purchaseDate: new Date(2025, 0, 1 + (i % 365)),
        cost: 1000 + (i % 500),
      },
    });
    if (i % 1000 === 0) {
      console.log(`  equipment ${i.toLocaleString()} / ${sizes.equipment.toLocaleString()}`);
    }
  }

  console.log('Seeding oficios…');
  for (let i = 0; i < sizes.oficios; i += 1) {
    const orgId = organizationIds[i % organizationIds.length]!;
    const createdById = userIds[i % userIds.length]!;
    await prisma.oficio.upsert({
      where: { id: deterministicId('perf-ofc', i) },
      update: {},
      create: {
        id: deterministicId('perf-ofc', i),
        organizationId: orgId,
        number: `PERF-${i.toString().padStart(6, '0')}`,
        systemNumber: `S-PERF-${i}`,
        type: 'INCOMING',
        subject: `Subject ${i + 1}`,
        status: 'COMPLETED',
        oficioDate: new Date(2026, 0, 1 + (i % 365)),
        institution: `Institution ${i % 25}`,
        createdById,
      },
    });
  }

  console.log('Seeding purchase orders…');
  for (let i = 0; i < sizes.purchaseOrders; i += 1) {
    const orgId = organizationIds[i % organizationIds.length]!;
    const createdById = userIds[i % userIds.length]!;
    await prisma.compraOrden.upsert({
      where: { id: deterministicId('perf-po', i) },
      update: {},
      create: {
        id: deterministicId('perf-po', i),
        organizationId: orgId,
        orderNumber: `OC-PERF-${i.toString().padStart(6, '0')}`,
        sequenceNumber: i + 1,
        sequenceYear: 2026,
        purchaseReference: 'PERF-REFERENCE',
        requestDate: new Date(2026, 0, 1 + (i % 365)),
        requiredDate: new Date(2026, 0, 1 + (i % 365) + 7),
        requestedByName: `User ${i + 1}`,
        requesterJobTitle: 'Analyst',
        supplierName: `Supplier ${i % 25}`,
        supplierRtn: '08011999123456',
        supplierPhone: '9999-9999',
        purchaseJustification: 'Justification for perf test',
        subtotal: 1000,
        discount: 0,
        tax: 150,
        total: 1150,
        status: 'DRAFT',
        createdById,
      },
    });
  }

  console.log('Seeding audit events…');
  for (let i = 0; i < sizes.auditEvents; i += 1) {
    const orgId = organizationIds[i % organizationIds.length]!;
    await prisma.systemAuditEvent.create({
      data: {
        organizationId: orgId,
        userId: userIds[i % userIds.length] ?? null,
        eventType: 'perf.generated',
        outcome: 'SUCCESS',
        severity: 'INFO',
        module: 'perf',
        entityType: 'Perf',
        entityId: randomUUID(),
        action: 'GENERATE',
        schemaVersion: 1,
        attributes: {
          iteration: i,
          nonce: randomInt(0, 1_000_000),
        },
      },
    });
    if (i % 10000 === 0) {
      console.log(`  audit ${i.toLocaleString()} / ${sizes.auditEvents.toLocaleString()}`);
    }
  }

  console.log('Done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
