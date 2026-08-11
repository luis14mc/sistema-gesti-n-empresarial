import { describe, expect, it, vi } from 'vitest';
import { IntegrationHttpClient } from '@/platform/integrations/application/http-client';
import {
  IntegrationConnectionFailedError,
  IntegrationRateLimitedError,
  IntegrationTimeoutError,
} from '@/platform/integrations/domain/integration-errors';

const RETRY_HEADER_BASE = { 'content-type': 'application/json' };

function buildResponse(status: number, body: string, headers: Record<string, string> = RETRY_HEADER_BASE): Response {
  const responseHeaders = new Headers(headers);
  return new Response(body, { status, headers: responseHeaders });
}

describe('IntegrationHttpClient', () => {
  it('blocks SSRF destinations before issuing a request', async () => {
    const fetcher = vi.fn();
    const client = new IntegrationHttpClient({ fetcher });
    await expect(
      client.request({
        url: 'http://127.0.0.1/admin',
        timeoutMs: 1000,
        requestId: 'req-1',
        provider: 'MICROSOFT_GRAPH',
        operation: 'test',
      }),
    ).rejects.toBeInstanceOf(IntegrationConnectionFailedError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('returns success and redacts sensitive headers in the result', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(
      buildResponse(200, '{"ok":true}', { 'x-some-header': 'plain' }),
    );
    const client = new IntegrationHttpClient({ fetcher });
    const result = await client.request({
      url: 'https://graph.microsoft.com/v1.0/me',
      timeoutMs: 1_000,
      requestId: 'req-2',
      provider: 'MICROSOFT_GRAPH',
      operation: 'test',
      headers: { authorization: 'Bearer SECRET' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.headers['x-some-header']).toBe('plain');
      expect((result.headers as Record<string, string>).authorization).toBeUndefined();
    }
  });

  it('retries transient failures and succeeds on a later attempt', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(buildResponse(503, 'busy'))
      .mockResolvedValueOnce(buildResponse(200, '{"ok":true}'));
    const client = new IntegrationHttpClient({ fetcher, sleep: async () => undefined });
    const result = await client.request({
      url: 'https://graph.microsoft.com/v1.0/me',
      timeoutMs: 1_000,
      requestId: 'req-3',
      provider: 'MICROSOFT_GRAPH',
      operation: 'test',
    });
    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not retry permanent failures', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(buildResponse(403, 'forbidden'));
    const client = new IntegrationHttpClient({ fetcher, sleep: async () => undefined });
    const result = await client.request({
      url: 'https://graph.microsoft.com/v1.0/me',
      timeoutMs: 1_000,
      requestId: 'req-4',
      provider: 'MICROSOFT_GRAPH',
      operation: 'test',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.classification).toBe('PERMANENT');
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('maps HTTP 429 to IntegrationRateLimitedError when retries are exhausted', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      buildResponse(429, 'too many', { 'retry-after': '1' }),
    );
    const client = new IntegrationHttpClient({ fetcher, sleep: async () => undefined });
    await expect(
      client.request({
        url: 'https://graph.microsoft.com/v1.0/me',
        timeoutMs: 1_000,
        requestId: 'req-5',
        provider: 'MICROSOFT_GRAPH',
        operation: 'test',
        retryPolicy: { maxAttempts: 1, baseDelayMs: 100, maxDelayMs: 1_000, jitterRatio: 0 },
      }),
    ).rejects.toBeInstanceOf(IntegrationRateLimitedError);
  });

  it('maps timeout to IntegrationTimeoutError and stops further attempts', async () => {
    const fetcher = vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const err = new DOMException('Aborted', 'AbortError');
        reject(err);
      });
    }));
    const client = new IntegrationHttpClient({ fetcher, sleep: async () => undefined });
    await expect(
      client.request({
        url: 'https://graph.microsoft.com/v1.0/me',
        timeoutMs: 50,
        requestId: 'req-6',
        provider: 'MICROSOFT_GRAPH',
        operation: 'test',
      }),
    ).rejects.toBeInstanceOf(IntegrationTimeoutError);
  });
});
