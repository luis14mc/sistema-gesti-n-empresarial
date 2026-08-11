/**
 * Background job handler registry.
 *
 * Phase 13 · 13D decision (see docs/remediation/audit-remediation-matrix.md):
 * The SGE has NO persistent background-job model and NO async job producers.
 * The only dispatch path is `SynchronousJobDispatcher`, which runs work
 * in-process within the originating request. Asynchronous background-job
 * processing is therefore **NOT_ENABLED_FOR_INITIAL_RELEASE**.
 *
 * This registry is the honest activation seam: if/when an async job model and
 * producers are introduced, real handlers register here and the worker resolves
 * them by `type`. Until then the registry is intentionally empty and the worker
 * runs dormant. Resolving an unknown type fails safely and visibly with
 * `JOB_HANDLER_NOT_FOUND` — never silently.
 */

export interface JobExecutionContext {
  readonly organizationId: string;
  readonly requestId: string;
  readonly attempt: number;
}

export interface BackgroundJobHandler<TPayload = unknown, TResult = unknown> {
  readonly type: string;
  execute(context: JobExecutionContext, payload: TPayload): Promise<TResult>;
}

export class JobHandlerNotFoundError extends Error {
  constructor(public readonly type: string) {
    super('JOB_HANDLER_NOT_FOUND');
    this.name = 'JobHandlerNotFoundError';
  }
}

export class JobHandlerRegistry {
  private readonly handlers = new Map<string, BackgroundJobHandler>();

  register(handler: BackgroundJobHandler): void {
    if (this.handlers.has(handler.type)) {
      throw new Error(`JOB_HANDLER_ALREADY_REGISTERED: ${handler.type}`);
    }
    this.handlers.set(handler.type, handler);
  }

  resolve(type: string): BackgroundJobHandler {
    const handler = this.handlers.get(type);
    if (!handler) throw new JobHandlerNotFoundError(type);
    return handler;
  }

  has(type: string): boolean {
    return this.handlers.has(type);
  }

  get size(): number {
    return this.handlers.size;
  }

  types(): string[] {
    return [...this.handlers.keys()];
  }
}

/**
 * The application registry. Intentionally EMPTY for the initial internal
 * release — no async job handlers are registered. This is the correct,
 * honest state, not an oversight.
 */
export const jobHandlerRegistry = new JobHandlerRegistry();
