#!/usr/bin/env tsx
/**
 * Elimina huérfanos listados en un CSV de storage:audit (solo >7 días).
 * Default: --dry-run. Requiere --confirm para borrar.
 *
 * pnpm storage:delete-orphans -- reports/storage-audit-2026-10-22.csv
 * pnpm storage:delete-orphans -- --confirm reports/storage-audit-2026-10-22.csv
 */
import { readFile } from 'fs/promises';
import { validateStorageEnvironment } from '@/platform/config/env';
import { getStorage } from '@/platform/storage';
import { isProtectedStorageExportKey } from '@/platform/storage/protected-prefixes';
import { parseOrphanKeysFromAuditCsv } from '@/platform/storage/storage-audit';

const MS_7_DAYS = 7 * 24 * 60 * 60 * 1000;

function parseArgs(argv: string[]) {
  const confirm = argv.includes('--confirm');
  const dryRun = !confirm;
  const csvPath = argv.find((arg) => !arg.startsWith('--') && arg.endsWith('.csv'));
  const explicitKeys = argv.filter((arg) => !arg.startsWith('--') && !arg.endsWith('.csv'));
  return { confirm, dryRun, csvPath, explicitKeys };
}

async function main(): Promise<void> {
  const { dryRun, csvPath, explicitKeys } = parseArgs(process.argv.slice(2));
  validateStorageEnvironment(process.env);

  if (!csvPath) {
    console.error('Uso: pnpm storage:delete-orphans [--confirm] <audit.csv> [key ...]');
    process.exit(1);
  }

  const csv = await readFile(csvPath, 'utf8');
  const orphansFromCsv = parseOrphanKeysFromAuditCsv(csv);
  const orphanKeySet = new Set(orphansFromCsv.map((o) => o.storageKey));

  const now = Date.now();
  const eligible = orphansFromCsv.filter((row) => {
    if (!row.lastModified) return false;
    const age = now - new Date(row.lastModified).getTime();
    return age > MS_7_DAYS;
  });

  const requestedKeys = explicitKeys.length
    ? explicitKeys.filter((key) => orphanKeySet.has(key))
    : eligible.map((row) => row.storageKey);

  const keysToDelete = requestedKeys.filter((key) => !isProtectedStorageExportKey(key));
  const rejectedProtected = requestedKeys.filter((key) => isProtectedStorageExportKey(key));
  for (const key of rejectedProtected) {
    console.error(`[storage:delete-orphans] Rechazada clave protegida: ${key}`);
  }

  if (keysToDelete.length === 0) {
    console.info('[storage:delete-orphans] No hay claves elegibles (huérfanas en CSV y >7 días).');
    return;
  }

  console.info(`[storage:delete-orphans] Modo: ${dryRun ? 'dry-run' : 'confirm'}`);
  console.info(`[storage:delete-orphans] Claves a procesar: ${keysToDelete.length}`);

  const storage = getStorage();
  for (const key of keysToDelete) {
    if (dryRun) {
      console.info(`  [dry-run] would delete ${key}`);
      continue;
    }
    await storage.remove(key);
    console.info(`  deleted ${key}`);
  }
}

main().catch((error) => {
  console.error('[storage:delete-orphans] Error', error);
  process.exit(1);
});
