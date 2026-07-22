import { prisma } from '../src/lib/prisma';
import { allocateOrderNumber } from '../src/lib/compras/orden/numbering';

async function main() {
  const drafts = await prisma.compraOrden.findMany({
    where: { status: 'DRAFT', orderNumber: null, deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Borradores sin correlativo encontrados: ${drafts.length}`);

  for (const draft of drafts) {
    const repaired = await prisma.$transaction(async (tx) => {
      const template = await tx.compraOrdenTemplate.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
        select: { orderPrefix: true },
      });
      const allocation = await allocateOrderNumber(tx, template?.orderPrefix || 'COM-CNI');
      const result = await tx.compraOrden.updateMany({
        where: { id: draft.id, status: 'DRAFT', orderNumber: null },
        data: allocation,
      });
      return result.count === 1 ? allocation.orderNumber : null;
    });

    if (repaired) console.log(`Reparada ${draft.id}: ${repaired}`);
    else console.log(`Omitida ${draft.id}: ya tenía correlativo o dejó de ser borrador`);
  }
}

main()
  .catch((error) => {
    console.error('No se pudo reparar los borradores:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
