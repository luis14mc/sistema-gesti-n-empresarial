export type TransactionRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  onRetry?: (input: { attempt: number; error: unknown }) => void;
};

function isRetryableTransactionError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2034';
}

const defaultSleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function withTransactionRetry<TResult>(
  operation: () => Promise<TResult>,
  options: TransactionRetryOptions = {},
): Promise<TResult> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 25;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === maxAttempts) throw error;
      options.onRetry?.({ attempt, error });
      await sleep(baseDelayMs * attempt);
    }
  }

  throw new Error('Unreachable transaction retry state');
}
