import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_ROOT = join(process.cwd(), 'prisma', 'migrations');
// Replays every migration with psql (one process per file) on a fresh DB: needs more than the 5s default.
const MIGRATION_REPLAY_TIMEOUT_MS = 120_000;
const TARGET_DIR = '20261016120000_oficios_excel_import_pdf_meta';
const FIXTURE_USER_PATH = join(process.cwd(), 'tests/migrations/fixtures/oficio_import_batches_orphan_user.sql');

function listMigrationDirs(): string[] {
  return readdirSync(MIGRATIONS_ROOT)
    .filter((entry) => {
      const full = join(MIGRATIONS_ROOT, entry);
      return statSync(full).isDirectory() && /^\d{14}_/.test(entry);
    })
    .sort();
}

function psqlFile(baseUrl: string, filePath: string): void {
  execSync(`psql "${baseUrl}" -v ON_ERROR_STOP=1 -f "${filePath}"`, {
    stdio: 'pipe',
    env: process.env,
  });
}

describe.skipIf(!process.env.SHADOW_DATABASE_URL)(
  'oficio_import_batches organizationId backfill (shadow DB + legacy fixture)',
  () => {
    it('assigns organizationId from memberships or org_cni_default and enforces NOT NULL', () => {
      const shadow = process.env.SHADOW_DATABASE_URL!;
      const adminUrl = shadow.replace(/\/[^/]+$/, '/postgres');
      const fixtureDb = `${shadow.replace(/\/[^/]+$/, '')}/sge_mig_fixture`;

      execSync(`psql "${adminUrl}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS sge_mig_fixture;"`, {
        stdio: 'pipe',
      });
      execSync(`psql "${adminUrl}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE sge_mig_fixture;"`, {
        stdio: 'pipe',
      });

      const dirs = listMigrationDirs();
      const targetIndex = dirs.indexOf(TARGET_DIR);
      expect(targetIndex).toBeGreaterThan(0);

      for (let index = 0; index < targetIndex; index += 1) {
        psqlFile(fixtureDb, join(MIGRATIONS_ROOT, dirs[index], 'migration.sql'));
      }

      psqlFile(fixtureDb, FIXTURE_USER_PATH);
      psqlFile(fixtureDb, join(process.cwd(), 'tests/migrations/fixtures/oficio_import_batches_legacy.sql'));
      psqlFile(fixtureDb, join(MIGRATIONS_ROOT, TARGET_DIR, 'migration.sql'));

      const countNull = execSync(
        `psql "${fixtureDb}" -t -A -c "SELECT COUNT(*) FROM oficio_import_batches WHERE \\"organizationId\\" IS NULL;"`,
        { encoding: 'utf-8' },
      ).trim();

      expect(countNull).toBe('0');

      const orphanOrg = execSync(
        `psql "${fixtureDb}" -t -A -c "SELECT \\"organizationId\\" FROM oficio_import_batches WHERE id = 'batch_fixture_orphan';"`,
        { encoding: 'utf-8' },
      ).trim();

      expect(orphanOrg).toBe('org_cni_default');

      const membershipOrg = execSync(
        `psql "${fixtureDb}" -t -A -c "SELECT \\"organizationId\\" FROM oficio_import_batches WHERE id = 'batch_fixture_membership';"`,
        { encoding: 'utf-8' },
      ).trim();

      expect(membershipOrg).toBe('org_cni_default');
    }, MIGRATION_REPLAY_TIMEOUT_MS);
  },
);
