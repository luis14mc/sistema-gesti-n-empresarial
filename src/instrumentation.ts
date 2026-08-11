export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEXT_PHASE !== 'phase-production-build') {
    try {
      const { getServerEnvironment } = await import('@/platform/config/env');
      getServerEnvironment();
    } catch (error) {
      console.error(error);
      process.exit(1);
    }
  }
}
