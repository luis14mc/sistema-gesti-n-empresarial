// Phase 10E — Accessibility harness using axe-core + Playwright.
//
// The harness runs the axe-core rules engine against a route and reports
// any "critical" or "serious" violations. Critical violations block the
// release gate; serious violations warn but do not block.
import AxeBuilder from '@axe-core/playwright';
import { type Page, type TestInfo, expect } from '@playwright/test';

export type AxeSummary = Readonly<{
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  violations: ReadonlyArray<{ id: string; impact: string; help: string; nodes: number }>;
}>;

export async function runAxe(page: Page, testInfo: TestInfo): Promise<AxeSummary> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag22aa'])
    .analyze();

  const summary: AxeSummary = {
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? 'minor',
      help: v.help,
      nodes: v.nodes.length,
    })),
  };
  for (const v of results.violations) {
    if (v.impact === 'critical') summary.critical += 1;
    else if (v.impact === 'serious') summary.serious += 1;
    else if (v.impact === 'moderate') summary.moderate += 1;
    else summary.minor += 1;
  }

  await testInfo.attach('axe-report.json', {
    body: JSON.stringify(summary, null, 2),
    contentType: 'application/json',
  });

  return summary;
}

export async function expectNoCriticalViolations(summary: AxeSummary): Promise<void> {
  if (summary.critical > 0) {
    const lines = summary.violations
      .filter((v) => v.impact === 'critical')
      .map((v) => `- ${v.id}: ${v.help} (${v.nodes} nodes)`)
      .join('\n');
    expect(summary.critical, `Critical axe violations:\n${lines}`).toBe(0);
  }
}

export async function expectNoSeriousViolations(summary: AxeSummary): Promise<void> {
  if (summary.serious > 0) {
    const lines = summary.violations
      .filter((v) => v.impact === 'serious')
      .map((v) => `- ${v.id}: ${v.help} (${v.nodes} nodes)`)
      .join('\n');
    expect(summary.serious, `Serious axe violations:\n${lines}`).toBe(0);
  }
}
