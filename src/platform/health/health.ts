export type HealthCheckStatus = 'ok' | 'unavailable';
export type ComponentHealthStatus = 'ok' | 'degraded';

export type ReadinessResult = Readonly<{
  status: 'ready' | 'not_ready';
  checks: Readonly<Record<string, HealthCheckStatus>>;
  components: Readonly<Record<string, ComponentHealthStatus>>;
  timestamp: string;
}>;

export type ReadinessDependencies = Readonly<{
  configuration: () => void | Promise<void>;
  database: () => void | Promise<void>;
  storage: () => void | Promise<void>;
  pdfEngine: () => void | Promise<void>;
  timeoutMs: number;
  pdfRequired: boolean;
}>;

async function withTimeout(operation: () => void | Promise<void>, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(operation),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('HEALTH_CHECK_TIMEOUT')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runReadinessChecks(dependencies: ReadinessDependencies): Promise<ReadinessResult> {
  const checks: Record<string, HealthCheckStatus> = {};
  const components: Record<string, ComponentHealthStatus> = { storage: 'degraded' };
  const entries: Array<[string, () => void | Promise<void>]> = [
    ['configuration', dependencies.configuration],
    ['database', dependencies.database],
  ];
  if (dependencies.pdfRequired) entries.push(['pdfEngine', dependencies.pdfEngine]);

  const [storageProbeOk] = await Promise.all([
    withTimeout(dependencies.storage, dependencies.timeoutMs)
      .then(() => true)
      .catch(() => false),
    Promise.all(entries.map(async ([name, check]) => {
      try {
        await withTimeout(check, dependencies.timeoutMs);
        checks[name] = 'ok';
      } catch {
        checks[name] = 'unavailable';
      }
    })),
  ]);

  components.storage = storageProbeOk ? 'ok' : 'degraded';

  return {
    status: Object.values(checks).every((status) => status === 'ok') ? 'ready' : 'not_ready',
    checks,
    components,
    timestamp: new Date().toISOString(),
  };
}
