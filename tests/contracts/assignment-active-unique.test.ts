import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Phase 13 · Part 1 — DB-free guards for the "one ACTIVE assignment per
 * equipment" invariant. These assert the migration and error mapping exist and
 * are shaped correctly. The behavioural proof (constraint actually rejects a
 * duplicate under concurrency) lives in the gated live-DB integration test
 * tests/integration/equipment-assignment-constraint.test.ts.
 */

const ROOT = resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

const MIGRATION =
  'prisma/migrations/20260803120000_equipment_assignment_active_unique/migration.sql';

describe('active-assignment partial unique index', () => {
  it('migration file exists', () => {
    expect(existsSync(resolve(ROOT, MIGRATION))).toBe(true);
  });

  it('creates a partial UNIQUE index on equipmentId WHERE status = ACTIVE', () => {
    const sql = read(MIGRATION);
    expect(sql).toMatch(/CREATE UNIQUE INDEX/i);
    expect(sql).toMatch(/"equipment_assignments"\s*\(\s*"equipmentId"\s*\)/);
    expect(sql).toMatch(/WHERE\s+"status"\s*=\s*'ACTIVE'/);
  });

  it('guards against applying over pre-existing duplicates (no auto-pick/delete)', () => {
    const sql = read(MIGRATION);
    expect(sql).toMatch(/RAISE EXCEPTION/i);
    expect(sql).toMatch(/HAVING COUNT\(\*\) > 1/i);
    expect(sql).not.toMatch(/DELETE FROM/i);
  });

  it('index name constant matches the migration', () => {
    const helper = read('src/modules/equipment/assignment-errors.ts');
    expect(helper).toContain('equipment_assignments_one_active_per_equipment');
    const sql = read(MIGRATION);
    expect(sql).toContain('equipment_assignments_one_active_per_equipment');
  });

  it('create + swap routes map the unique violation to EQUIPMENT_ALREADY_ASSIGNED', () => {
    for (const rel of [
      'src/app/api/equipment-assignments/route.ts',
      'src/app/api/equipment-assignments/swap/route.ts',
    ]) {
      const src = read(rel);
      expect(src).toMatch(/isActiveAssignmentConflict/);
      expect(src).toMatch(/EQUIPMENT_ALREADY_ASSIGNED/);
    }
  });
});
