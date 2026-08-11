import { validateWorkerEnvironment } from '../platform/config/env';
import { createLogger } from '../platform/observability/logger';
import { jobHandlerRegistry } from '../platform/jobs/registry';
import { WorkerRuntime, type WorkerProcessor } from './runtime';

const environment = validateWorkerEnvironment(process.env);
const log = createLogger({ module: 'worker', environment: environment.APP_ENV });

/**
 * Phase 13 · 13D remediation.
 *
 * Previously the worker threw `BACKGROUND_JOB_PROCESSOR_NOT_IMPLEMENTED` on
 * start, which crash-loops any deployed worker container and misrepresents the
 * system: there is in fact NO async background-job model or producer to process
 * (all dispatch is synchronous / in-request — see platform/jobs/dispatcher.ts).
 *
 * Async background processing is honestly classified as
 * NOT_ENABLED_FOR_INITIAL_RELEASE. The worker now runs DORMANT: it registers no
 * handlers, does no work, and simply stays alive until it receives a shutdown
 * signal, then exits cleanly. When the job-handler registry gains real handlers
 * this dormant processor is replaced by a claiming loop — the seam already
 * exists in platform/jobs/registry.ts.
 */
const dormantProcessor: WorkerProcessor = {
  async start(signal: AbortSignal): Promise<void> {
    log.info('worker.dormant.started', {
      registeredHandlers: jobHandlerRegistry.size,
      mode: 'NOT_ENABLED_FOR_INITIAL_RELEASE',
      note: 'No async job handlers registered; worker is idle by design.',
    });

    // Stay alive doing nothing until shutdown is requested. This resolves
    // (rather than throwing) so the container is healthy while dormant.
    await new Promise<void>((resolve) => {
      if (signal.aborted) return resolve();
      signal.addEventListener('abort', () => resolve(), { once: true });
    });
  },
  async stop(): Promise<void> {
    log.info('worker.dormant.stopped');
  },
};

const runtime = new WorkerRuntime(dormantProcessor, environment.WORKER_SHUTDOWN_TIMEOUT_MS);
let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('worker.shutdown.started', { signal });
  try {
    await runtime.shutdown();
    log.info('worker.shutdown.completed');
    process.exitCode = 0;
  } catch (error) {
    log.error('worker.shutdown.failed', { errorCode: 'WORKER_SHUTDOWN_FAILED', error });
    process.exit(1);
  }
}

process.once('SIGTERM', () => void shutdown('SIGTERM'));
process.once('SIGINT', () => void shutdown('SIGINT'));

runtime.start().catch((error) => {
  log.error('worker.start.failed', { errorCode: 'WORKER_START_FAILED', error });
  process.exit(1);
});
