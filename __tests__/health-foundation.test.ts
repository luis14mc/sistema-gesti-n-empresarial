import { describe, expect, it, vi } from 'vitest';
import { GET as liveness } from '@/app/api/health/live/route';
import { runReadinessChecks } from '@/platform/health/health';

describe('deployment health foundation', () => {
  it('keeps liveness healthy without database connectivity', async () => {
    const response = await liveness();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: 'live' });
  });

  it('fails readiness when the database is unavailable', async () => {
    const result = await runReadinessChecks({
      configuration: vi.fn(),
      database: vi.fn().mockRejectedValue(new Error('connection refused')),
      storage: vi.fn(),
      pdfEngine: vi.fn(),
      timeoutMs: 100,
      pdfRequired: true,
    });
    expect(result.status).toBe('not_ready');
    expect(result.checks).toEqual({
      configuration: 'ok',
      database: 'unavailable',
      storage: 'ok',
      pdfEngine: 'ok',
    });
  });

  it('does not expose dependency error messages', async () => {
    const result = await runReadinessChecks({
      configuration: vi.fn(),
      database: vi.fn().mockRejectedValue(new Error('postgresql://secret-host/private-db')),
      storage: vi.fn(),
      pdfEngine: vi.fn(),
      timeoutMs: 100,
      pdfRequired: false,
    });
    expect(JSON.stringify(result)).not.toContain('secret-host');
  });
});
