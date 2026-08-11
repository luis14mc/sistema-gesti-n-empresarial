// Phase 11A — safety guard tests for the synthetic dataset generator.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..');
const SCRIPT = readFileSync(
  resolve(REPO_ROOT, 'scripts/performance/generate-dataset.ts'),
  'utf-8',
);

const CLEAN = readFileSync(
  resolve(REPO_ROOT, 'scripts/performance/clean-dataset.ts'),
  'utf-8',
);

describe('synthetic dataset generator — safety guards', () => {
  it('requires PERFORMANCE_TEST_MODE=true', () => {
    expect(SCRIPT).toMatch(/PERFORMANCE_TEST_MODE !== 'true'/);
  });

  it('rejects production-shaped DATABASE_URL', () => {
    expect(SCRIPT).toMatch(/production|prod\./i);
  });

  it('requires an explicit --yes flag for >100k rows', () => {
    expect(SCRIPT).toMatch(/--yes/);
  });

  it('rejects unknown profiles', () => {
    expect(SCRIPT).toMatch(/Unknown profile/);
  });

  it('exposes the three documented profiles', () => {
    expect(SCRIPT).toMatch(/small/);
    expect(SCRIPT).toMatch(/medium/);
    expect(SCRIPT).toMatch(/large/);
  });

  it('uses deterministic ids for reproducibility', () => {
    expect(SCRIPT).toMatch(/createHash/);
    expect(SCRIPT).toMatch(/sha256/);
  });

  it('marks each profile with the documented sizes', () => {
    expect(SCRIPT).toMatch(/organizations:\s*5/);
    expect(SCRIPT).toMatch(/organizations:\s*25/);
    expect(SCRIPT).toMatch(/organizations:\s*100/);
  });

  it('rotates the organizationId across tenants in the dataset', () => {
    expect(SCRIPT).toMatch(/organizationIds\[i % organizationIds\.length\]/);
  });
});

describe('synthetic dataset cleaner — safety guards', () => {
  it('requires PERFORMANCE_TEST_MODE=true', () => {
    expect(CLEAN).toMatch(/PERFORMANCE_TEST_MODE !== 'true'/);
  });

  it('rejects production-shaped DATABASE_URL', () => {
    expect(CLEAN).toMatch(/production|prod\./i);
  });

  it('only deletes rows whose id starts with perf-', () => {
    expect(CLEAN).toMatch(/id:\s*\{\s*startsWith:\s*'perf-'\s*\}/);
  });
});
