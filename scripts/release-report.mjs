#!/usr/bin/env node
// Phase 10G — release report generator.
//
// Reads the JUnit XML, the coverage summary, the Playwright report, the
// accessibility report, and the performance baselines, and emits a
// single JSON report that the release manager signs off.
//
// Usage:
//   node scripts/release-report.mjs
//
// Output:
//   reports/release-report.json
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve('.');
const REPORTS = resolve(REPO_ROOT, 'reports');
const COVERAGE = resolve(REPO_ROOT, 'coverage', 'coverage-summary.json');

function readCoverage() {
  if (!existsSync(COVERAGE)) return null;
  try {
    return JSON.parse(readFileSync(COVERAGE, 'utf-8'));
  } catch {
    return null;
  }
}

function readJunit() {
  const path = resolve(REPORTS, 'junit.xml');
  if (!existsSync(path)) return null;
  const xml = readFileSync(path, 'utf-8');
  const match = xml.match(/<testsuite[^>]+/);
  if (!match) return null;
  const attrs = match[0];
  const pick = (key) => Number((attrs.match(new RegExp(`${key}="(\\d+)"`)) ?? [, 0])[1]);
  return {
    tests: pick('tests'),
    failures: pick('failures'),
    errors: pick('errors'),
    skipped: pick('skipped'),
  };
}

function readPlaywrightSummary() {
  const html = resolve(REPORTS, 'playwright-html');
  if (!existsSync(html)) return null;
  try {
    const files = readdirSync(html);
    const dataFile = files.find((f) => f.endsWith('.json') || f === 'data');
    if (!dataFile) return { files: files.length };
    return { files: files.length };
  } catch {
    return null;
  }
}

function readAxeSummary() {
  // Look for axe-report.json artifacts attached by tests.
  const candidates = [
    resolve(REPORTS, 'axe-summary.json'),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      try {
        return JSON.parse(readFileSync(path, 'utf-8'));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function readPerformanceBaseline() {
  const path = resolve(REPO_ROOT, 'tests', 'performance', 'baselines.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  version: process.env.GITHUB_REF_NAME || 'local',
  commit: process.env.GITHUB_SHA || 'unknown',
  junit: readJunit(),
  coverage: readCoverage(),
  playwright: readPlaywrightSummary(),
  accessibility: readAxeSummary(),
  performance: readPerformanceBaseline(),
  gates: {
    lint: 'pending',
    typecheck: 'pending',
    unit: 'pending',
    integration: 'pending',
    security: 'pending',
    e2e: 'pending',
    accessibility: 'pending',
    build: 'pending',
  },
  knownRisks: [],
  rollbackPlan: 'Re-run the previous release image; Prisma migration down + cached build artifacts.',
  approval: { required: true, approvers: [] },
};

const dest = resolve(REPORTS, 'release-report.json');
writeFileSync(dest, JSON.stringify(report, null, 2));
console.log(`Wrote ${dest}`);
