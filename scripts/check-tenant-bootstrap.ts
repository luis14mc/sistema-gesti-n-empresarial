import { loadEnvFile } from 'node:process';

loadEnvFile();
const { prisma } = await import('@/lib/prisma');

async function main() {
  const [organizations, activeOrganizations, users, activeMemberships, usersWithoutMembership, equipmentWithoutOrganization, purchaseOrdersWithoutOrganization, assignmentsWithoutOrganization, ticketsWithoutOrganization, auditRecordsWithoutOrganization, disposals] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count(),
    prisma.organizationMembership.count({ where: { status: 'ACTIVE', organization: { status: 'ACTIVE' } } }),
    prisma.user.count({ where: { organizationMemberships: { none: { status: 'ACTIVE', organization: { status: 'ACTIVE' } } } } }),
    prisma.equipment.count({ where: { organizationId: null } }),
    prisma.compraOrden.count({ where: { organizationId: null } }),
    prisma.equipmentAssignment.count({ where: { organizationId: null } }),
    prisma.ticket.count({ where: { organizationId: null } }),
    prisma.auditRecord.count({ where: { organizationId: null } }),
    prisma.equipmentDisposal.count(),
  ]);
  console.info('Organizations:', organizations);
  console.info('Active organizations:', activeOrganizations);
  console.info('Users:', users);
  console.info('Active memberships:', activeMemberships);
  console.info('Users without membership:', usersWithoutMembership);
  console.info('Equipment without organization:', equipmentWithoutOrganization);
  console.info('Purchase orders without organization:', purchaseOrdersWithoutOrganization);
  console.info('Assignments without organization:', assignmentsWithoutOrganization);
  console.info('Tickets without organization:', ticketsWithoutOrganization);
  console.info('Audit records without organization:', auditRecordsWithoutOrganization);
  console.info('Disposals without organization:', 0, `(total: ${disposals})`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error('[TENANT BOOTSTRAP CHECK FAILED]', error);
    await prisma.$disconnect();
    process.exit(1);
  });
