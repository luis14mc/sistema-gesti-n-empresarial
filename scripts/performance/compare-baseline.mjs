#!/usr/bin/env node
// Phase 11A — compare baseline against the latest k6 summary.
//
// Usage:
//   k6 run --summary-export=reports/perf-summary.json tests/performance/scenarios/load.js
//   node scripts/performance/compare-baseline.mjs
//
// Reads `docs/performance/baseline.json` (the committed baseline) and
// `reports/perf-summary.json` (the latest k6 run). Emits a JSON
// report at `reports/perf-compare.json` and fails the process when
// the regression threshold is breached.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASELINE = resolve('docs/performance/baseline.json');
const SUMMARY = resolve('reports/perf-summary.json');
const REPORT = resolve('reports/perf-compare.json');

if (!existsSync(BASELINE)) {
  console.error(`Baseline not found at ${BASELINE}. Commit the first run before comparing.`);
  process.exit(1);
}
if (!existsSync(SUMMARY)) {
  console.error(`Latest k6 summary not found at ${SUMMARY}.`);
  process.exit(1);
}

interface Baseline { version: string; scenarios: { name: string; p95_ms: number; p99_ms: number; error_rate_pct: number }[] }
interface Summary { metrics: Record<string, { values: Record<string, number> }> }

const baseline = JSON.parse(readFileSync(BASELINE, 'utf-8')) as Baseline;
const summary = JSON.parse(readFileSync(SUMMARY, 'utf-8')) as Summary;

const get = (metric: string, key: string): number | undefined => summary.metrics[metric]?.values[key];

interface Row { scenario: string; base_p95: number; new_p95: number; delta_pct: number; blocking: boolean; warning: boolean }
const rows: Row[] = [];

for (const scenario of baseline.scenarios) {
  const metricName = scenario.name.replaceAll('-', '_');
  const newP95 = get(`http_req_duration{scenario:${metricName}}`, 'p(95)') ?? NaN;
  const newP99 = get(`http_req_duration{scenario:${metricName}}`, 'p(99)') ?? NaN;
  const errorRate = get(`http_req_failed{scenario:${metricName}}`, 'rate') ?? 0;
  const delta = ((newP95 - scenario.p95_ms) / scenario.p95_ms) * 100;
  const blocking = delta > 20 || (errorRate * 100) > scenario.error_rate_pct + 0.5;
  const warning = delta > 10 || (errorRate * 100) > scenario.error_rate_pct + 0.1;
  rows.push({
    scenario: scenario.name,
    base_p95: scenario.p95_ms,
    new_p95: Math.round(newP95),
    delta_pct: Math.round(delta * 100) / 100,
    blocking,
    warning,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  baseline_version: baseline.version,
  rows,
  blocking: rows.filter((r) => r.blocking).length,
  warnings: rows.filter((r) => r.warning).length,
};

writeFileSync(REPORT, JSON.stringify(report, null, 2));

console.log(`Wrote ${REPORT}`);
console.log(`Blocking regressions: ${report.blocking}`);
console.log(`Warnings: ${report.warnings}`);

if (report.blocking > 0) {
  process.exit(2);
}
