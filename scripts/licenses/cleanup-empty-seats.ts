#!/usr/bin/env tsx
/**
 * Marca CANCELLED licencias vacías (sin cuenta, clave, equipo ni historial de asignaciones).
 * Dry-run por defecto; use --confirm para aplicar. Nunca borra filas.
 */
import { cleanupEmptySeats } from '@/modules/software-licenses/application/cleanup-empty-seats';
import { prisma } from '@/lib/prisma';

const confirm = process.argv.includes('--confirm');

async function main() {
  const result = await cleanupEmptySeats(confirm);
  console.log(`Encontradas ${result.candidates.length} licencias vacías candidatas.`);
  for (const id of result.candidates) {
    console.log(`- ${id}`);
  }
  if (result.dryRun) {
    console.log('\nDry-run: no se modificó nada. Ejecute con --confirm para marcar CANCELLED.');
    return;
  }
  console.log(`Actualizadas ${result.updated} licencias a CANCELLED.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
