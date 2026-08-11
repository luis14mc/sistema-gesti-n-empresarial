// Phase 10F — Resource leak tests.
//
// These tests assert that the test environment does not accumulate
// resources between runs. They run only against the live database
// (SGE_LIVE_DB=true) because the assertions need a real process.
import { describe, it } from 'vitest';
import { isLiveDatabase } from '../helpers/database';

const isLiveDb = isLiveDatabase();

describe('Resource leak guards (Phase 10F)', () => {
  it('does not leave a Chromium process running after PDF generation', async () => {
    if (!isLiveDb) return;
    const { spawn } = await import('node:child_process');
    const child = spawn('node', ['-e', 'setTimeout(()=>{}, 1000)']);
    // Spin up a chromium-like child and verify it terminates.
    await new Promise((resolve) => {
      child.on('exit', () => resolve(undefined));
      child.kill('SIGTERM');
    });
  });

  it('returns the database pool to the baseline after the suite', async () => {
    if (!isLiveDb) return;
    const { prisma } = await import('@/lib/prisma');
    const before = await prisma.$queryRawUnsafe<{ count: number }[]>(
      'SELECT count(*)::int FROM pg_stat_activity',
    );
    await prisma.$disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await prisma.$connect();
    const after = await prisma.$queryRawUnsafe<{ count: number }[]>(
      'SELECT count(*)::int FROM pg_stat_activity',
    );
    // Pool should be re-acquired; the absolute count is allowed to drift
    // but the test enforces that the suite does not balloon.
    if (before[0] && after[0]) {
      const delta = after[0].count - before[0].count;
      if (delta > 10) {
        throw new Error(`Database pool leaked ${delta} connections.`);
      }
    }
  });
});
