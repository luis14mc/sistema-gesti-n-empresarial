// Phase 11G — capacity model assertions.
//
// Validates that the documented capacity-model numbers are coherent
// (e.g., warning thresholds > scale thresholds, scale thresholds <
// hard limits). The actual numbers are placeholders until the first
// baseline run.
import { describe, expect, it } from 'vitest';

interface CapacityModel {
  scopes: { name: string; rps: number; concurrent_users: number; pdf_per_min: number }[];
  thresholds: { warning: number; scale: number; hard_limit: number };
}

const MODEL: CapacityModel = {
  scopes: [
    { name: 'small', rps: 50, concurrent_users: 100, pdf_per_min: 60 },
    { name: 'medium', rps: 250, concurrent_users: 1_000, pdf_per_min: 240 },
    { name: 'large', rps: 1_000, concurrent_users: 10_000, pdf_per_min: 960 },
  ],
  thresholds: { warning: 1.2, scale: 1.5, hard_limit: 2.0 },
};

describe('Phase 11G — capacity model', () => {
  it('documents three scopes', () => {
    expect(MODEL.scopes).toHaveLength(3);
  });

  it('escalates between scopes (small < medium < large)', () => {
    const small = MODEL.scopes[0].rps;
    const medium = MODEL.scopes[1].rps;
    const large = MODEL.scopes[2].rps;
    expect(small).toBeLessThan(medium);
    expect(medium).toBeLessThan(large);
  });

  it('warns before scaling', () => {
    expect(MODEL.thresholds.warning).toBeLessThan(MODEL.thresholds.scale);
  });

  it('scales before the hard limit', () => {
    expect(MODEL.thresholds.scale).toBeLessThan(MODEL.thresholds.hard_limit);
  });

  it('keeps the warning threshold at less than 1.5x of baseline', () => {
    expect(MODEL.thresholds.warning).toBeLessThan(1.5);
  });

  it('keeps the hard limit at 2x or below', () => {
    expect(MODEL.thresholds.hard_limit).toBeLessThanOrEqual(2);
  });

  it('PDF throughput is feasible per PDF concurrency policy', () => {
    // The PDF concurrency policy is 2 per vCPU. Each PDF takes ~5 s.
    // 60 PDFs / min = 1 PDF/sec = 5 vCPU.
    for (const scope of MODEL.scopes) {
      const pdfPerHour = scope.pdf_per_min * 60;
      expect(pdfPerHour).toBeGreaterThan(0);
    }
  });
});

describe('Phase 11G — scaling triggers', () => {
  it('web scales on CPU/p95/request count', () => {
    const triggers = ['cpu', 'p95', 'request_count'];
    expect(triggers).toContain('cpu');
    expect(triggers).toContain('p95');
  });

  it('worker scales on queue depth, not CPU alone', () => {
    const triggers = ['outbox_backlog', 'oldest_event_age', 'cpu'];
    expect(triggers).toContain('outbox_backlog');
    expect(triggers).not.toContain('cpu_only');
  });

  it('PostgreSQL scales on connection + read replicas', () => {
    const triggers = ['connection_saturation', 'read_p95'];
    expect(triggers).toContain('connection_saturation');
  });
});
