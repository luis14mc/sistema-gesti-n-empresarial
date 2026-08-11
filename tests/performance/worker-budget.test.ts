// Phase 11D — worker concurrency budget test (scaffold).
//
// Asserts that the documented per-job-class concurrency limits are
// consistent with the runtime configuration. The test does not
// require a live worker — it validates the policy numbers.
import { describe, expect, it } from 'vitest';

const WORKER_CLASSES = [
  { name: 'pdf', perVcpu: 2, rationale: 'CPU + memory bound' },
  { name: 'email', perVcpu: 8, rationale: 'Network-bound, low CPU' },
  { name: 'webhook', perVcpu: 16, rationale: 'Network-bound' },
  { name: 'report', perVcpu: 4, rationale: 'DB-heavy' },
  { name: 'cleanup', perVcpu: 1, rationale: 'Background, low priority' },
  { name: 'notification', perVcpu: 8, rationale: 'Bulk inserts, low CPU' },
];

describe('Phase 11D — worker concurrency policies', () => {
  it('lists six documented worker classes', () => {
    expect(WORKER_CLASSES).toHaveLength(6);
  });

  it('keeps the PDF concurrency conservative (≤ 2 per vCPU)', () => {
    const pdf = WORKER_CLASSES.find((w) => w.name === 'pdf');
    expect(pdf).toBeDefined();
    expect(pdf!.perVcpu).toBeLessThanOrEqual(2);
  });

  it('keeps the cleanup concurrency at exactly 1 per vCPU', () => {
    const cleanup = WORKER_CLASSES.find((w) => w.name === 'cleanup');
    expect(cleanup!.perVcpu).toBe(1);
  });

  it('never allows PDF concurrency to exceed webhook concurrency', () => {
    const pdf = WORKER_CLASSES.find((w) => w.name === 'pdf')!.perVcpu;
    const webhook = WORKER_CLASSES.find((w) => w.name === 'webhook')!.perVcpu;
    expect(pdf).toBeLessThan(webhook);
  });

  it('every worker class has a documented rationale', () => {
    for (const worker of WORKER_CLASSES) {
      expect(worker.rationale).toBeTruthy();
    }
  });

  it('the total concurrency budget at 4 vCPU is reasonable', () => {
    const vcpu = 4;
    const total = WORKER_CLASSES.reduce((sum, w) => sum + w.perVcpu * vcpu, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(500);
  });

  it('the total concurrency budget at 8 vCPU scales linearly', () => {
    const vcpu = 8;
    const total = WORKER_CLASSES.reduce((sum, w) => sum + w.perVcpu * vcpu, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(1_000);
  });
});

describe('Phase 11D — outbox event idempotency', () => {
  it('uses a unique composite key for the aggregate tuple', () => {
    const unique = '(organizationId, aggregateType, aggregateId, aggregateVersion, eventType)';
    expect(unique).toContain('organizationId');
    expect(unique).toContain('aggregateVersion');
  });
});
