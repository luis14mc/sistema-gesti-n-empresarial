export interface WorkerProcessor {
  start(signal: AbortSignal): Promise<void>;
  stop(): Promise<void>;
}

export class WorkerRuntime {
  private readonly abortController = new AbortController();
  private stopping: Promise<void> | null = null;

  constructor(
    private readonly processor: WorkerProcessor,
    private readonly shutdownTimeoutMs: number,
  ) {}

  start(): Promise<void> {
    return this.processor.start(this.abortController.signal);
  }

  shutdown(): Promise<void> {
    if (this.stopping) return this.stopping;
    this.abortController.abort();
    this.stopping = Promise.race([
      this.processor.stop(),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('WORKER_SHUTDOWN_TIMEOUT')), this.shutdownTimeoutMs).unref();
      }),
    ]);
    return this.stopping;
  }
}
