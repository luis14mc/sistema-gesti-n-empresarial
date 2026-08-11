import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_ROOT = join(process.cwd(), 'prisma', 'migrations');

type MigrationFile = Readonly<{
  directory: string;
  file: string;
  content: string;
}>;

function listMigrations(): MigrationFile[] {
  return readdirSync(MIGRATIONS_ROOT)
    .filter((entry) => {
      const full = join(MIGRATIONS_ROOT, entry);
      return statSync(full).isDirectory() && /^\d{14}_/.test(entry);
    })
    .sort()
    .flatMap((directory) => {
      const sql = join(MIGRATIONS_ROOT, directory, 'migration.sql');
      try {
        const content = readFileSync(sql, 'utf-8');
        return [{ directory, file: sql, content }];
      } catch {
        return [];
      }
    });
}

function hasCreateTable(content: string, table: string): boolean {
  const pattern = new RegExp(`CREATE TABLE\\s+(?:IF NOT EXISTS\\s+)?[\`"]?${table}[\`"]?`, 'i');
  return pattern.test(content);
}

function hasAddColumn(content: string, table: string, column: string): boolean {
  const pattern = new RegExp(`ALTER TABLE\\s+[\`"]?${table}[\`"]?\\s+ADD COLUMN\\s+(?:IF NOT EXISTS\\s+)?[\`"]?${column}[\`"]?`, 'i');
  return pattern.test(content);
}

function hasUniqueIndex(content: string, table: string, columns: string[]): boolean {
  const cols = columns.join('","');
  const pattern = new RegExp(
    `CREATE\\s+UNIQUE\\s+INDEX\\s+[\`"]?[^\`"]+[\`"]?\\s+ON\\s+[\`"]?${table}[\`"]?\\s*\\(\\s*[\`"]?${cols}[\`"]?`,
    'i',
  );
  return pattern.test(content);
}

describe('Migration directory layout (Phase 10A migration validation)', () => {
  const migrations = listMigrations();

  it('contains at least one migration', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it('uses a 14-digit prefix for every directory', () => {
    for (const migration of migrations) {
      expect(migration.directory).toMatch(/^\d{14}_/);
    }
  });

  it('uses the canonical migration.sql filename in every directory', () => {
    for (const migration of migrations) {
      expect(migration.file.endsWith(`${migration.directory}/migration.sql`)).toBe(true);
    }
  });
});

describe('Phase 1 — tenant hardening migration (Phase 10A migration validation)', () => {
  const migrations = listMigrations();
  const migration = migrations.find((m) => m.directory.includes('phase1_tenant_hardening'));
  it('exists and creates the per-organization composite unique indexes on business tables', () => {
    expect(migration).toBeDefined();
    if (!migration) return;
    // Phase 1 enforces tenant isolation via CREATE UNIQUE INDEX on
    // (organizationId, businessKey) — every business table must have one.
    expect(migration.content).toMatch(/CREATE UNIQUE INDEX\s+"equipment_organizationId_inventoryCode_key"/i);
    expect(migration.content).toMatch(/CREATE UNIQUE INDEX\s+"purchase_orders_organizationId_orderNumber_key"/i);
    expect(migration.content).toMatch(/CREATE UNIQUE INDEX\s+"oficios_organizationId_systemNumber_key"/i);
    // audit_records is hardened via SET NOT NULL on organizationId (no
    // dedicated unique index because it carries its own idempotency key
    // enforced in code).
    expect(migration.content).toMatch(/ALTER TABLE\s+"audit_records"\s+ALTER COLUMN\s+"organizationId"\s+SET NOT NULL/i);
  });
});

describe('Phase 7A — organization lifecycle migration (Phase 10A migration validation)', () => {
  const migrations = listMigrations();
  const migration = migrations.find((m) => m.directory.includes('phase7a_organization_lifecycle'));
  it('exists and adds the new lifecycle enum values', () => {
    expect(migration).toBeDefined();
    if (!migration) return;
    expect(migration.content).toMatch(/ALTER TYPE\s+"OrganizationStatus"\s+ADD VALUE IF NOT EXISTS\s+'PROVISIONING'/i);
    expect(migration.content).toMatch(/ALTER TYPE\s+"OrganizationStatus"\s+ADD VALUE IF NOT EXISTS\s+'ARCHIVED'/i);
    expect(migration.content).toMatch(/ALTER TYPE\s+"OrganizationStatus"\s+ADD VALUE IF NOT EXISTS\s+'PENDING_DELETION'/i);
    expect(migration.content).toMatch(/CREATE TYPE\s+"OnboardingStatus"/i);
  });
});

describe('Phase 8A — notifications migration (Phase 10A migration validation)', () => {
  const migrations = listMigrations();
  const migration = migrations.find((m) => m.directory.includes('phase8a_notification_foundation'));
  it('exists and creates the notifications and notification_deliveries tables with the unique idempotency key', () => {
    expect(migration).toBeDefined();
    if (!migration) return;
    expect(hasCreateTable(migration.content, 'notifications')).toBe(true);
    expect(hasCreateTable(migration.content, 'notification_deliveries')).toBe(true);
    expect(migration.content).toContain('"idempotencyKey"');
  });
});

describe('Phase 9A — integrations migration (Phase 10A migration validation)', () => {
  const migrations = listMigrations();
  const migration = migrations.find((m) => m.directory.includes('phase9a_integration_foundation'));
  it('exists and creates the integration tables with the per-organization unique key', () => {
    expect(migration).toBeDefined();
    if (!migration) return;
    expect(hasCreateTable(migration.content, 'organization_integrations')).toBe(true);
    expect(hasCreateTable(migration.content, 'integration_executions')).toBe(true);
    expect(migration.content).toMatch(/CREATE UNIQUE INDEX\s+"organization_integrations_organizationId_provider_name_key"/i);
  });
});

describe('No post-Phase-1 migration drops a business table (Phase 10A data quality)', () => {
  const migrations = listMigrations();
  // Pre-Phase-1 migrations (before 20260722210000) cleaned up legacy tables;
  // that historical cleanup is part of the baseline. From Phase 1 onward the
  // policy is strict: no migration drops a business table.
  const cutoffPrefix = '20260722210000';
  for (const migration of migrations) {
    if (migration.directory < cutoffPrefix) continue;
    it(`${migration.directory} does not DROP TABLE`, () => {
      expect(migration.content).not.toMatch(/DROP\s+TABLE/i);
    });
  }
});

describe('Every CREATE TABLE has a primary key (Phase 10A data quality)', () => {
  const migrations = listMigrations();
  for (const migration of migrations) {
    if (!/CREATE\s+TABLE/i.test(migration.content)) continue;
    it(`${migration.directory} declares primary keys`, () => {
      const pkRegex = /CREATE\s+TABLE\s+[`"]?\w+[`"]?\s*\([^;]*PRIMARY\s+KEY/i;
      expect(migration.content).toMatch(pkRegex);
    });
  }
});
