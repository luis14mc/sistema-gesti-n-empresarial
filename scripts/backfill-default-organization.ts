import { loadEnvFile } from 'node:process';

loadEnvFile();
const { prisma } = await import('@/lib/prisma');

const DEFAULT_ORGANIZATION_ID = process.env.DEFAULT_ORGANIZATION_ID ?? 'org_cni_default';
const DEFAULT_ORGANIZATION_SLUG = process.env.DEFAULT_ORGANIZATION_SLUG ?? 'cni';
const DEFAULT_ORGANIZATION_NAME = process.env.DEFAULT_ORGANIZATION_NAME ?? 'Consejo Nacional de Inversiones';

async function main() {
  await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.upsert({
      where: { slug: DEFAULT_ORGANIZATION_SLUG },
      update: {},
      create: {
        id: DEFAULT_ORGANIZATION_ID,
        name: DEFAULT_ORGANIZATION_NAME,
        legalName: DEFAULT_ORGANIZATION_NAME,
        slug: DEFAULT_ORGANIZATION_SLUG,
      },
    });

    const users = await tx.user.findMany({ select: { id: true, role: true } });
    for (const user of users) {
      const role = user.role === 'ADMIN'
        ? 'ADMIN'
        : user.role === 'IT'
          ? 'IT_TECHNICIAN'
          : user.role === 'RRHH'
            ? 'HR'
            : 'USER';
      await tx.organizationMembership.upsert({
        where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
        update: {},
        create: { organizationId: organization.id, userId: user.id, role },
      });
    }

    await Promise.all([
      tx.equipment.updateMany({ where: { organizationId: null }, data: { organizationId: organization.id } }),
      tx.compraOrden.updateMany({ where: { organizationId: null }, data: { organizationId: organization.id } }),
      tx.auditRecord.updateMany({ where: { organizationId: null }, data: { organizationId: organization.id } }),
    ]);

    await tx.disposalPolicy.upsert({
      where: { organizationId: organization.id },
      update: {},
      create: { organizationId: organization.id },
    });
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error('[ORGANIZATION BACKFILL FAILED]', error);
    await prisma.$disconnect();
    process.exit(1);
  });
