import type { OrganizationRole, Role } from '@prisma/client';
import { loadEnvFile } from 'node:process';

loadEnvFile();
const { prisma } = await import('@/lib/prisma');

const organizationDefaults = {
  id: process.env.DEFAULT_ORGANIZATION_ID ?? 'org_cni_default',
  slug: process.env.DEFAULT_ORGANIZATION_SLUG ?? 'cni',
  name: process.env.DEFAULT_ORGANIZATION_NAME ?? 'Consejo Nacional de Inversiones',
};

function membershipRole(role: Role): OrganizationRole {
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'IT') return 'IT_MANAGER';
  if (role === 'RRHH') return 'HR';
  return 'USER';
}

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: organizationDefaults.slug },
    update: { status: 'ACTIVE' },
    create: {
      id: organizationDefaults.id,
      slug: organizationDefaults.slug,
      name: organizationDefaults.name,
      legalName: organizationDefaults.name,
      status: 'ACTIVE',
      settings: {
        locale: 'es-HN', currency: 'HNL', timezone: 'America/Tegucigalpa',
        disposalFolioPrefix: 'DICT-BAJA',
      },
    },
  });
  console.info('Organization created/found:', organization.slug);

  if (organization.settings === null) {
    await prisma.organization.update({
      where: { id: organization.id },
      data: { settings: { locale: 'es-HN', currency: 'HNL', timezone: 'America/Tegucigalpa', disposalFolioPrefix: 'DICT-BAJA' } },
    });
  }

  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  let membershipsCreated = 0;
  for (const user of users) {
    const existing = await prisma.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      select: { id: true },
    });
    if (!existing) membershipsCreated += 1;
    await prisma.organizationMembership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: { status: 'ACTIVE' },
      create: { organizationId: organization.id, userId: user.id, role: membershipRole(user.role), status: 'ACTIVE' },
    });
  }

  const [equipment, purchaseOrders, assignments, tickets, auditRecords] = await prisma.$transaction([
    prisma.equipment.updateMany({ where: { organizationId: null }, data: { organizationId: organization.id } }),
    prisma.compraOrden.updateMany({ where: { organizationId: null }, data: { organizationId: organization.id } }),
    prisma.equipmentAssignment.updateMany({ where: { organizationId: null }, data: { organizationId: organization.id } }),
    prisma.ticket.updateMany({ where: { organizationId: null }, data: { organizationId: organization.id } }),
    prisma.auditRecord.updateMany({ where: { organizationId: null }, data: { organizationId: organization.id } }),
  ]);
  await prisma.disposalPolicy.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: { organizationId: organization.id },
  });

  console.info('Users processed:', users.length);
  console.info('Memberships created:', membershipsCreated);
  console.info('Equipment backfilled:', equipment.count);
  console.info('Purchase orders backfilled:', purchaseOrders.count);
  console.info('Assignments backfilled:', assignments.count);
  console.info('Tickets backfilled:', tickets.count);
  console.info('Audit records backfilled:', auditRecords.count);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error('[SAAS BOOTSTRAP FAILED]', error);
    await prisma.$disconnect();
    process.exit(1);
  });
