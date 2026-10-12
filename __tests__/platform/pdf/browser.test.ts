import { afterEach, describe, expect, it, vi } from 'vitest';

describe('browserLaunchArguments', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('includes --no-sandbox when PUPPETEER_DISABLE_SANDBOX=true', async () => {
    vi.stubEnv('PUPPETEER_DISABLE_SANDBOX', 'true');
    const { browserLaunchArguments } = await import('@/platform/pdf/browser');
    const args = browserLaunchArguments();
    expect(args).toContain('--no-sandbox');
    expect(args).toContain('--disable-setuid-sandbox');
  });

  it('does not include sandbox flags when PUPPETEER_DISABLE_SANDBOX=false', async () => {
    vi.stubEnv('PUPPETEER_DISABLE_SANDBOX', 'false');
    vi.stubEnv('RAILWAY_ENVIRONMENT', 'production');
    const originalGetuid = process.getuid;
    process.getuid = () => 1000;
    try {
      const { browserLaunchArguments } = await import('@/platform/pdf/browser');
      const args = browserLaunchArguments();
      expect(args).not.toContain('--no-sandbox');
    } finally {
      process.getuid = originalGetuid;
    }
  });

  it('includes sandbox flags in non-root container without explicit env', async () => {
    vi.stubEnv('RAILWAY_ENVIRONMENT', 'production');
    delete process.env.PUPPETEER_DISABLE_SANDBOX;
    const originalGetuid = process.getuid;
    process.getuid = () => 1000;
    try {
      const { browserLaunchArguments } = await import('@/platform/pdf/browser');
      const args = browserLaunchArguments();
      expect(args).toContain('--no-sandbox');
    } finally {
      process.getuid = originalGetuid;
    }
  });
});
