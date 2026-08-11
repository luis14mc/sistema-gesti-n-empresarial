import { prisma } from '@/lib/prisma';
import { getStorage } from '@/lib/storage';
import { getServerEnvironment } from '@/platform/config/env';
import { checkBrowserAvailability } from '@/platform/pdf/browser';
import type { ReadinessDependencies } from './health';
import { readdir } from 'fs/promises';
import path from 'path';

export function defaultReadinessDependencies(): ReadinessDependencies {
  const environment = getServerEnvironment();
  return {
    configuration: () => { getServerEnvironment(); },
    database: async () => {
      const migrationDirectories = (await readdir(path.join(process.cwd(), 'prisma', 'migrations'), { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      const expectedMigration = migrationDirectories.at(-1);
      if (!expectedMigration) throw new Error('MIGRATION_MISMATCH');
      const failedMigrations = await prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "_prisma_migrations"
        WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL
      `;
      if ((failedMigrations[0]?.count ?? 0n) > 0n) throw new Error('MIGRATION_MISMATCH');
      const expectedMigrationState = await prisma.$queryRaw<Array<{ finishedAt: Date | null }>>`
        SELECT "finished_at" AS "finishedAt"
        FROM "_prisma_migrations"
        WHERE "migration_name" = ${expectedMigration}
          AND "rolled_back_at" IS NULL
        ORDER BY "started_at" DESC
        LIMIT 1
      `;
      if (!expectedMigrationState[0]?.finishedAt) throw new Error('MIGRATION_MISMATCH');
      await prisma.$queryRaw`SELECT 1`;
    },
    storage: async () => {
      const storage = getStorage();
      if (storage.ping) await storage.ping();
    },
    pdfEngine: checkBrowserAvailability,
    timeoutMs: environment.HEALTH_CHECK_TIMEOUT_MS,
    pdfRequired: environment.PDF_ENGINE_REQUIRED,
  };
}
