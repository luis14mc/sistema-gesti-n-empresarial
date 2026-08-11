export const TRANSIENT_HTTP_STATUSES: ReadonlySet<number> = new Set<number>([
  408, // Request Timeout
  425, // Too Early
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
  507, // Insufficient Storage
  511, // Network Authentication Required
]);

export const PERMANENT_HTTP_STATUSES: ReadonlySet<number> = new Set<number>([
  400,
  401,
  403,
  404,
  405,
  406,
  409,
  410,
  415,
  422,
  451,
]);

export type RetryClassification = 'TRANSIENT' | 'PERMANENT' | 'UNKNOWN';

export type RetryPolicyInput = Readonly<{
  status?: number;
  cause?: 'timeout' | 'connection' | 'abort' | 'unknown';
  message?: string;
}>;

export function classifyFailure(input: RetryPolicyInput): RetryClassification {
  if (input.status !== undefined) {
    if (TRANSIENT_HTTP_STATUSES.has(input.status)) return 'TRANSIENT';
    if (PERMANENT_HTTP_STATUSES.has(input.status)) return 'PERMANENT';
  }
  if (input.cause === 'timeout' || input.cause === 'connection') return 'TRANSIENT';
  if (input.cause === 'abort') return 'PERMANENT';
  if (input.cause === 'unknown') return 'UNKNOWN';
  return 'UNKNOWN';
}

export type RetryDecision = Readonly<{
  retry: boolean;
  reason: 'TRANSIENT' | 'MAX_ATTEMPTS' | 'PERMANENT' | 'UNKNOWN';
  delayMs: number;
}>;

export type RetryPolicy = Readonly<{
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}>;

export const DEFAULT_RETRY_POLICY: RetryPolicy = Object.freeze({
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 5_000,
  jitterRatio: 0.2,
});

export function shouldRetry(
  input: { attempt: number; classification: RetryClassification; policy?: RetryPolicy },
): RetryDecision {
  const policy = input.policy ?? DEFAULT_RETRY_POLICY;
  if (input.attempt >= policy.maxAttempts) {
    return { retry: false, reason: 'MAX_ATTEMPTS', delayMs: 0 };
  }
  if (input.classification === 'PERMANENT') {
    return { retry: false, reason: 'PERMANENT', delayMs: 0 };
  }
  if (input.classification === 'UNKNOWN') {
    return { retry: false, reason: 'UNKNOWN', delayMs: 0 };
  }
  const exponential = policy.baseDelayMs * 2 ** (input.attempt - 1);
  const bounded = Math.min(exponential, policy.maxDelayMs);
  const jitter = bounded * policy.jitterRatio;
  const offset = (Math.random() * 2 - 1) * jitter;
  return { retry: true, reason: 'TRANSIENT', delayMs: Math.max(0, Math.round(bounded + offset)) };
}
