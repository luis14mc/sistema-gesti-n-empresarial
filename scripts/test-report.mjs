#!/usr/bin/env node
// Phase 10A test report helper.
// Reads the JUnit XML and coverage summary, prints a short report to stdout.
// Designed to run after `pnpm test:ci` so CI can capture the report as an artifact.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const junitPath = resolve('reports/junit.xml');
const coverageSummary = resolve('coverage/coverage-summary.json');

function readCoverageSummary() {
  if (!existsSync(coverageSummary)) return null;
  try {
    return JSON.parse(readFileSync(coverageSummary, 'utf-8'));
  } catch {
    return null;
  }
}

function readJunit() {
  if (!existsSync(junitPath)) return null;
  const xml = readFileSync(junitPath, 'utf-8');
  const testsuite = xml.match(/<testsuite[^>]*>/);
  if (!testsuite) return null;
  const attributes = testsuite[0];
  const name = (attributes.match(/name="([^"]+)"/) ?? [, 'unknown'])[1];
  const tests = Number((attributes.match(/tests="(\d+)"/) ?? [, '0'])[1]);
  const failures = Number((attributes.match(/failures="(\d+)"/) ?? [, '0'])[1]);
  const errors = Number((attributes.match(/errors="(\d+)"/) ?? [, '0'])[1]);
  const skipped = Number((attributes.match(/skipped="(\d+)"/) ?? [, '0'])[1]);
  const time = Number((attributes.match(/time="(\d+(?:\.\d+)?)"/) ?? [, '0'])[1]);
  return { name, tests, failures, errors, skipped, time };
}

const junit = readJunit();
const coverage = readCoverageSummary();

const report = {
  generatedAt: new Date().toISOString(),
  junit,
  coverage,
};

console.log(JSON.stringify(report, null, 2));
