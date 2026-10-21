import { prisma } from '@/lib/prisma';

/** Misma consulta que GET /api/compras/template (Fase 4b — sin cambio de comportamiento). */
export async function findActivePurchaseOrderTemplateForOrganization(organizationId: string) {
  return prisma.compraOrdenTemplate.findFirst({
    where: { isActive: true, createdBy: { organizationMemberships: { some: { organizationId } } } },
    orderBy: { version: 'desc' },
  });
}
