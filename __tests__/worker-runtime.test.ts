import { describe, expect, it, vi } from 'vitest';
import { WorkerRuntime, type WorkerProcessor } from '@/worker/runtime';

describe('worker runtime lifecycle', () => {
  it('aborts active polling and drains the processor during shutdown', async () => {
    let signal: AbortSignal | undefined;
    const processor: WorkerProcessor = {
      start: vi.fn(async (receivedSignal) => {
        signal = receivedSignal;
      }),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    const runtime = new WorkerRuntime(processor, 1_000);
    await runtime.start();
    await runtime.shutdown();
    expect(signal?.aborted).toBe(true);
    expect(processor.stop).toHaveBeenCalledOnce();
  });

  it('makes repeated shutdown requests idempotent', async () => {
    const processor: WorkerProcessor = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };
    const runtime = new WorkerRuntime(processor, 1_000);
    await Promise.all([runtime.shutdown(), runtime.shutdown()]);
    expect(processor.stop).toHaveBeenCalledOnce();
  });

  it('fails shutdown when the processor exceeds its drain timeout', async () => {
    const processor: WorkerProcessor = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(() => new Promise<void>(() => {})),
    };
    const runtime = new WorkerRuntime(processor, 10);
    await expect(runtime.shutdown()).rejects.toThrow('WORKER_SHUTDOWN_TIMEOUT');
  });
});
