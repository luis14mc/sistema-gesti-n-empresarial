import { describe, expect, it } from 'vitest';
import { buildCspHeader } from '@/middleware';

describe('CSP for PDF print iframe', () => {
  it('allows blob URLs in frame-src', () => {
    const csp = buildCspHeader('test-nonce');
    expect(csp).toContain("frame-src 'self' blob:");
  });
});
