export interface Job<TResult = void> {
  readonly name: string;
  run(): TResult | Promise<TResult>;
}

export interface JobDispatcher {
  dispatch<TResult>(job: Job<TResult>): Promise<TResult>;
}

/** Executes work in the caller's process while retaining an async dispatcher contract. */
export class SynchronousJobDispatcher implements JobDispatcher {
  async dispatch<TResult>(job: Job<TResult>): Promise<TResult> {
    return await job.run();
  }
}
