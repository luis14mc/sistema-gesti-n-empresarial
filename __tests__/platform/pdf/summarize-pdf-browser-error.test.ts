import { describe, expect, it } from 'vitest';
import { summarizePdfBrowserError } from '@/platform/pdf/browser';

describe('summarizePdfBrowserError', () => {
  it('includes nested cause messages', () => {
    const inner = new Error('credentials.cc Check failed: Permission denied');
    const outer = new Error('Failed to launch browser', { cause: inner });
    expect(summarizePdfBrowserError(outer)).toContain('Permission denied');
  });
});
