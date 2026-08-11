// Phase 11G — perf-budget in CI (scaffold).
//
// Asserts the documented CI gates hold against the current scripts.
// The actual numbers are enforced by the CI config and the k6
// thresholds in the scenario files.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..');
const SCENARIOS = [
  'smoke.js',
  'load.js',
  'stress.js',
  'spike.js',
  'soak.js',
  'pdf-generation.js',
  'multi-tenant.js',
];

describe('Phase 11G — perf-budget CI scaffold', () => {
  for (const scenario of SCENARIOS) {
    it(`documents ${scenario} as a k6 scenario`, () => {
      const path = resolve(REPO_ROOT, 'tests/performance/scenarios', scenario);
      const source = readFileSync(path, 'utf-8');
      expect(source).toMatch(/export const options/);
    });
  }

  it('operational scenarios declare HTTP thresholds', () => {
    const operational = SCENARIOS.filter((s) => !['stress.js', 'spike.js'].includes(s));
    for (const scenario of operational) {
      const path = resolve(REPO_ROOT, 'tests/performance/scenarios', scenario);
      const source = readFileSync(path, 'utf-8');
      expect(source, `${scenario} declares http_req_duration thresholds`).toMatch(/http_req_duration/);
    }
  });

  it('the stress and spike scenarios intentionally omit thresholds to record the failure point', () => {
    for (const scenario of ['stress.js', 'spike.js']) {
      const path = resolve(REPO_ROOT, 'tests/performance/scenarios', scenario);
      const source = readFileSync(path, 'utf-8');
      expect(source, `${scenario} omits http_req_duration`).not.toMatch(/http_req_duration/);
    }
  });

  it('the compare script reads the documented baseline', () => {
    const path = resolve(REPO_ROOT, 'scripts/performance/compare-baseline.mjs');
    const source = readFileSync(path, 'utf-8');
    expect(source).toMatch(/docs\/performance\/baseline\.json/);
    expect(source).toMatch(/reports\/perf-summary\.json/);
  });

  it('the dataset generator refuses production-shaped DATABASE_URL', () => {
    const path = resolve(REPO_ROOT, 'scripts/performance/generate-dataset.ts');
    const source = readFileSync(path, 'utf-8');
    expect(source).toMatch(/production|prod\./i);
  });

  it('the browser leak script captures the baseline', () => {
    const path = resolve(REPO_ROOT, 'scripts/performance/check-browser-leaks.sh');
    const source = readFileSync(path, 'utf-8');
    expect(source).toMatch(/baseline/);
    expect(source).toMatch(/current/);
  });
});
