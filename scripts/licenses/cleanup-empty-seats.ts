#!/usr/bin/env tsx
/**
 * Marca CANCELLED licencias vacías (sin cuenta, clave, equipo ni historial de asignaciones).
 * Dry-run por defecto; use --confirm para aplicar. Nunca borra filas.
 */
import { prisma } from '@/lib/prisma';

const confirm = process.argv.includes('--confirm');

async function main() {
  const candidates = await prisma.softwareLicenseSeat.findMany({
    where: {
      status: { not: 'CANCELLED' },
      accountEmail: null,
      accountIdentifier: null,
      licenseKey: null,
      equipmentId: null,
      assignments: { none: {} },
    },
    include: { subscription: { include: { product: true } } },
  });

  console.log(`Encontradas ${candidates.length} licencias vacías candidatas.`);
  for (const seat of candidates) {
    console.log(`- ${seat.id} · ${seat.subscription.product.name} · ${seat.seatType}`);
  }

  if (!confirm) {
    console.log('\nDry-run: no se modificó nada. Ejecute con --confirm para marcar CANCELLED.');
    return;
  }

  if (candidates.length === 0) return;

  const result = await prisma.softwareLicenseSeat.updateMany({
    where: { id: { in: candidates.map((s) => s.id) } },
    data: { status: 'CANCELLED' },
  });
  console.log(`Actualizadas ${result.count} licencias a CANCELLED.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
