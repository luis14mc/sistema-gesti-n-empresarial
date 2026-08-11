import { describe, expect, it } from 'vitest';
import {
  JobHandlerRegistry,
  JobHandlerNotFoundError,
  jobHandlerRegistry,
  type BackgroundJobHandler,
} from '@/platform/jobs/registry';

/**
 * Phase 13 · 13D regression.
 * The worker no longer throws BACKGROUND_JOB_PROCESSOR_NOT_IMPLEMENTED; async
 * job processing is honestly dormant with an empty registry. These tests lock
 * the registry contract: empty by default, register/resolve works, and unknown
 * types fail safely and visibly with JOB_HANDLER_NOT_FOUND.
 */

const makeHandler = (type: string): BackgroundJobHandler => ({
  type,
  async execute() {
    return { ok: true };
  },
});

describe('JobHandlerRegistry', () => {
  it('the application registry is intentionally empty for the initial release', () => {
    expect(jobHandlerRegistry.size).toBe(0);
    expect(jobHandlerRegistry.types()).toEqual([]);
  });

  it('registers and resolves a handler by type', () => {
    const registry = new JobHandlerRegistry();
    const handler = makeHandler('demo.job');
    registry.register(handler);
    expect(registry.has('demo.job')).toBe(true);
    expect(registry.resolve('demo.job')).toBe(handler);
    expect(registry.size).toBe(1);
  });

  it('rejects duplicate registration', () => {
    const registry = new JobHandlerRegistry();
    registry.register(makeHandler('dup'));
    expect(() => registry.register(makeHandler('dup'))).toThrow(/JOB_HANDLER_ALREADY_REGISTERED/);
  });

  it('fails safely and visibly on an unknown type', () => {
    const registry = new JobHandlerRegistry();
    expect(() => registry.resolve('missing')).toThrow(JobHandlerNotFoundError);
    try {
      registry.resolve('missing');
    } catch (error) {
      expect((error as Error).message).toBe('JOB_HANDLER_NOT_FOUND');
      expect((error as JobHandlerNotFoundError).type).toBe('missing');
    }
  });
});
