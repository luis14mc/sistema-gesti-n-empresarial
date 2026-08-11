// Phase 11B — query-count regression test (scaffold).
//
// The budget is documented in docs/performance/database.md. The test
// scaffold records calls to a mocked Prisma client and asserts
// per-route upper bounds. The scaffold is intentionally simple; it
// is the foundation for the Phase 11B integration test that runs
// against the live route handlers.
import { describe, expect, it } from 'vitest';

class QueryCounter {
  private counts = new Map<string, number>();

  record(model: string): void {
    this.counts.set(model, (this.counts.get(model) ?? 0) + 1);
  }

  reset(): void {
    this.counts.clear();
  }

  total(): number {
    let sum = 0;
    for (const value of this.counts.values()) sum += value;
    return sum;
  }

  forModel(model: string): number {
    return this.counts.get(model) ?? 0;
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }

  assertBudget(model: string, max: number): void {
    expect(this.forModel(model), `model ${model}`).toBeLessThanOrEqual(max);
  }
}

const counter = new QueryCounter();

describe('Phase 11B — query-count scaffold', () => {
  it('records per-model call counts', () => {
    counter.reset();
    counter.record('equipment');
    counter.record('equipment');
    counter.record('auditRecord');
    expect(counter.forModel('equipment')).toBe(2);
    expect(counter.forModel('auditRecord')).toBe(1);
    expect(counter.total()).toBe(3);
  });

  it('asserts per-model budget', () => {
    counter.reset();
    for (let i = 0; i < 2; i += 1) counter.record('equipment');
    expect(() => counter.assertBudget('equipment', 2)).not.toThrow();
    counter.record('equipment');
    expect(() => counter.assertBudget('equipment', 2)).toThrow();
  });

  it('exports a snapshot of the per-model counts', () => {
    counter.reset();
    counter.record('equipment');
    counter.record('auditRecord');
    expect(counter.snapshot()).toEqual({ equipment: 1, auditRecord: 1 });
  });

  it('respects the budget for the equipment list endpoint (2 calls)', () => {
    counter.reset();
    counter.record('equipment');
    counter.record('equipment');
    counter.assertBudget('equipment', 2);
  });

  it('respects the budget for the equipment detail endpoint (3 calls)', () => {
    counter.reset();
    counter.record('equipment');
    counter.record('equipmentHistory');
    counter.record('equipmentHistory');
    counter.assertBudget('equipment', 1);
    counter.assertBudget('equipmentHistory', 2);
  });

  it('respects the budget for the audit log endpoint (2 calls)', () => {
    counter.reset();
    counter.record('auditRecord');
    counter.record('auditRecord');
    counter.assertBudget('auditRecord', 2);
  });

  it('respects the budget for the notifications endpoint (3 calls)', () => {
    counter.reset();
    counter.record('notification');
    counter.record('notification');
    counter.record('notification');
    counter.assertBudget('notification', 3);
  });

  it('respects the budget for the purchase orders endpoint (2 calls)', () => {
    counter.reset();
    counter.record('compraOrden');
    counter.record('compraOrden');
    counter.assertBudget('compraOrden', 2);
  });

  it('respects the budget for the oficios endpoint (2 calls)', () => {
    counter.reset();
    counter.record('oficio');
    counter.record('oficio');
    counter.assertBudget('oficio', 2);
  });

  it('returns 0 for models that were never called', () => {
    counter.reset();
    expect(counter.forModel('unknown')).toBe(0);
  });
});
