import { loadEnvFile } from 'node:process';

loadEnvFile();
const { prisma } = await import('@/lib/prisma');

async function main() {
  const nullCount = async (table: string) => {
    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "organizationId" IS NULL`
    );
    return Number(rows[0]?.count ?? 0);
  };
  const [organizations, activeOrganizations, users, activeMemberships, usersWithoutMembership, equipmentWithoutOrganization, purchaseOrdersWithoutOrganization, assignmentsWithoutOrganization, ticketsWithoutOrganization, auditRecordsWithoutOrganization, disposals] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count(),
    prisma.organizationMembership.count({ where: { status: 'ACTIVE', organization: { status: 'ACTIVE' } } }),
    prisma.user.count({ where: { organizationMemberships: { none: { status: 'ACTIVE', organization: { status: 'ACTIVE' } } } } }),
    nullCount('equipment'),
    nullCount('purchase_orders'),
    nullCount('equipment_assignments'),
    nullCount('tickets'),
    nullCount('audit_records'),
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
  const failures = usersWithoutMembership + equipmentWithoutOrganization + purchaseOrdersWithoutOrganization
    + assignmentsWithoutOrganization + ticketsWithoutOrganization + auditRecordsWithoutOrganization;
  if (activeOrganizations === 0 || failures > 0) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error('[TENANT BOOTSTRAP CHECK FAILED]', error);
    await prisma.$disconnect();
    process.exit(1);
  });
