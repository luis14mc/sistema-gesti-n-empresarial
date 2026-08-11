import { createLogger } from '@/platform/observability/logger';
import { IntegrationConnectionFailedError, IntegrationRateLimitedError, IntegrationTimeoutError, isIntegrationDomainError } from '../domain/integration-errors';
import { classifyFailure, DEFAULT_RETRY_POLICY, shouldRetry, type RetryClassification, type RetryPolicy } from './retry-policy';
import { checkUrlForSsrf, type SsrfPolicy } from './ssrf-guard';
import { integrationCircuitBreakers } from './circuit-breaker';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export type HttpHeaders = Readonly<Record<string, string>>;

export type HttpClientInput = Readonly<{
  url: string;
  method?: HttpMethod;
  headers?: HttpHeaders;
  body?: string | Uint8Array | null;
  timeoutMs: number;
  requestId: string;
  organizationId?: string;
  integrationId?: string;
  provider: string;
  operation: string;
  retryPolicy?: RetryPolicy;
  ssrfPolicy?: SsrfPolicy;
  maxResponseBytes?: number;
  correlationId?: string;
  signal?: AbortSignal;
}>;

export type HttpClientSuccess = Readonly<{
  ok: true;
  status: number;
  headers: Readonly<Record<string, string>>;
  text: string;
  durationMs: number;
  attempt: number;
  url: string;
}>;

export type HttpClientFailure = Readonly<{
  ok: false;
  status?: number;
  headers?: Readonly<Record<string, string>>;
  text?: string;
  durationMs: number;
  attempt: number;
  url: string;
  classification: RetryClassification;
  errorCode: string;
  errorMessage: string;
}>;

export type HttpClientResult = HttpClientSuccess | HttpClientFailure;

const DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const FORWARDED_HEADERS = new Set(['authorization', 'x-api-key', 'cookie', 'set-cookie']);

function sanitizeHeaders(headers: HttpHeaders): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (FORWARDED_HEADERS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
      continue;
    }
    result[key] = value;
  }
  return result;
}

function safeHeaderRecord(headers: Headers): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (FORWARDED_HEADERS.has(lower)) {
      result[key] = '[REDACTED]';
      return;
    }
    if (value.length > 512) {
      result[key] = `${value.slice(0, 256)}...[TRUNCATED]`;
      return;
    }
    result[key] = value;
  });
  return result;
}

export class IntegrationHttpClient {
  private readonly fetcher: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: { fetcher?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async request(input: HttpClientInput): Promise<HttpClientResult> {
    const ssrfCheck = checkUrlForSsrf(input.url, input.ssrfPolicy);
    if (!ssrfCheck.ok) {
      throw new IntegrationConnectionFailedError(
        input.provider as never,
        'SSRF_BLOCKED',
        `Destination blocked: ${ssrfCheck.reason ?? 'unknown'}`,
      );
    }

    const log = createLogger({
      requestId: input.requestId,
      organizationId: input.organizationId,
      module: 'integrations',
    });

    const breaker = integrationCircuitBreakers.for(`${input.provider}:${input.integrationId ?? 'global'}`);
    if (!breaker.canExecute()) {
      const snapshot = breaker.snapshot();
      return {
        ok: false,
        durationMs: 0,
        attempt: 0,
        url: input.url,
        classification: 'TRANSIENT',
        errorCode: 'CIRCUIT_OPEN',
        errorMessage: `Circuit breaker open for ${input.provider}.`,
        ...(snapshot.openedAt ? { headers: { 'x-circuit-opened-at': snapshot.openedAt.toISOString() } } : {}),
      };
    }

    const policy = input.retryPolicy ?? DEFAULT_RETRY_POLICY;
    const maxResponseBytes = input.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;

    let attempt = 0;
    let lastFailure: HttpClientFailure | null = null;

    while (attempt < policy.maxAttempts) {
      attempt += 1;
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), input.timeoutMs);
      const linkedSignal = linkSignals(controller.signal, input.signal);
      const startedAt = Date.now();

      try {
        const init: RequestInit = {
          method: input.method ?? 'GET',
          headers: input.headers,
          signal: linkedSignal,
          redirect: 'manual',
        };
        if (input.body !== undefined && input.body !== null) {
          init.body = input.body as BodyInit;
        }
        const response = await this.fetcher(input.url, init);
        clearTimeout(timeoutHandle);
        const durationMs = Date.now() - startedAt;
        const headers = safeHeaderRecord(response.headers);
        const text = await readBoundedText(response, maxResponseBytes);
        if (response.ok) {
          breaker.recordSuccess();
          log.info('integration.http.success', {
            provider: input.provider,
            operation: input.operation,
            status: response.status,
            durationMs,
            attempt,
            integrationId: input.integrationId,
            correlationId: input.correlationId,
          });
          return {
            ok: true,
            status: response.status,
            headers,
            text,
            durationMs,
            attempt,
            url: input.url,
          };
        }
        const classification = classifyFailure({ status: response.status });
        const failure: HttpClientFailure = {
          ok: false,
          status: response.status,
          headers,
          text,
          durationMs,
          attempt,
          url: input.url,
          classification,
          errorCode: `HTTP_${response.status}`,
          errorMessage: `Provider returned HTTP ${response.status}.`,
        };
        const decision = shouldRetry({ attempt, classification, policy });
        if (!decision.retry) {
          breaker.recordFailure();
          if (response.status === 429) {
            throw new IntegrationRateLimitedError(input.provider as never, retryAfterMsFromHeaders(response.headers));
          }
          log.warn('integration.http.permanent_failure', {
            provider: input.provider,
            operation: input.operation,
            status: response.status,
            durationMs,
            attempt,
            integrationId: input.integrationId,
            reason: decision.reason,
          });
          return failure;
        }
        lastFailure = failure;
        log.warn('integration.http.transient_failure', {
          provider: input.provider,
          operation: input.operation,
          status: response.status,
          durationMs,
          attempt,
          nextDelayMs: decision.delayMs,
          integrationId: input.integrationId,
        });
        await this.sleep(decision.delayMs);
      } catch (error) {
        clearTimeout(timeoutHandle);
        if (isIntegrationDomainError(error)) {
          throw error;
        }
        const durationMs = Date.now() - startedAt;
        if (isAbortError(error)) {
          const classification = classifyFailure({ cause: 'timeout' });
          const failure: HttpClientFailure = {
            ok: false,
            durationMs,
            attempt,
            url: input.url,
            classification,
            errorCode: 'TIMEOUT',
            errorMessage: `Operation timed out after ${input.timeoutMs}ms.`,
          };
          breaker.recordFailure();
          throw new IntegrationTimeoutError(input.provider as never, input.timeoutMs);
        }
        const classification = classifyFailure({ cause: 'connection', message: error instanceof Error ? error.message : String(error) });
        const failure: HttpClientFailure = {
          ok: false,
          durationMs,
          attempt,
          url: input.url,
          classification,
          errorCode: 'CONNECTION_ERROR',
          errorMessage: error instanceof Error ? error.message : 'Connection error.',
        };
        breaker.recordFailure();
        log.error('integration.http.connection_error', {
          provider: input.provider,
          operation: input.operation,
          durationMs,
          attempt,
          integrationId: input.integrationId,
          error,
        });
        return failure;
      }
    }

    if (lastFailure) {
      breaker.recordFailure();
      return lastFailure;
    }
    breaker.recordFailure();
    return {
      ok: false,
      durationMs: 0,
      attempt,
      url: input.url,
      classification: 'UNKNOWN',
      errorCode: 'UNKNOWN',
      errorMessage: 'No HTTP attempt completed.',
    };
  }
}

export function sanitizeHeadersForLog(headers: HttpHeaders): Readonly<Record<string, string>> {
  return sanitizeHeaders(headers);
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && error.name === 'AbortError') return true;
  return false;
}

function linkSignals(primary: AbortSignal, secondary?: AbortSignal): AbortSignal {
  if (!secondary) return primary;
  const controller = new AbortController();
  const onPrimary = () => controller.abort();
  const onSecondary = () => controller.abort();
  primary.addEventListener('abort', onPrimary, { once: true });
  secondary.addEventListener('abort', onSecondary, { once: true });
  return controller.signal;
}

async function readBoundedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Response body exceeded ${maxBytes} bytes.`);
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

function retryAfterMsFromHeaders(headers: Headers): number | undefined {
  const retryAfter = headers.get('retry-after');
  if (!retryAfter) return undefined;
  const seconds = Number.parseInt(retryAfter, 10);
  if (Number.isFinite(seconds)) return Math.max(0, seconds) * 1000;
  const date = Date.parse(retryAfter);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return undefined;
}

export const integrationHttpClient = new IntegrationHttpClient();
