export type HealthCheckStatus = 'ok' | 'unavailable';
export type ReadinessResult = Readonly<{
  status: 'ready' | 'not_ready';
  checks: Readonly<Record<string, HealthCheckStatus>>;
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
  const entries: Array<[string, () => void | Promise<void>]> = [
    ['configuration', dependencies.configuration],
    ['database', dependencies.database],
    ['storage', dependencies.storage],
  ];
  if (dependencies.pdfRequired) entries.push(['pdfEngine', dependencies.pdfEngine]);

  await Promise.all(entries.map(async ([name, check]) => {
    try {
      await withTimeout(check, dependencies.timeoutMs);
      checks[name] = 'ok';
    } catch {
      checks[name] = 'unavailable';
    }
  }));

  return {
    status: Object.values(checks).every((status) => status === 'ok') ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  };
}
