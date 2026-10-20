import type { EmailMessage, EmailTransport } from '@/platform/email/types';

export const MAX_EMAIL_ATTEMPTS = 3;
export const EMAIL_RETRY_DELAYS_MS = [1_000, 5_000, 15_000] as const;

export function classifyEmailFailure(error: unknown): 'transient' | 'permanent' {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as NodeJS.ErrnoException | undefined)?.code ?? '';
  if (/invalid|mailbox|recipient|550|551|553|554|no such user/i.test(message)) return 'permanent';
  if (['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ESOCKET', 'ETIMEOUT'].includes(code)) return 'transient';
  if (/421|450|452|temporary|timeout|try again/i.test(message)) return 'transient';
  return 'permanent';
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmailWithRetries(
  transport: EmailTransport,
  message: EmailMessage,
): Promise<{ messageId: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_EMAIL_ATTEMPTS; attempt += 1) {
    try {
      return await transport.send(message);
    } catch (error) {
      lastError = error;
      if (classifyEmailFailure(error) === 'permanent' || attempt === MAX_EMAIL_ATTEMPTS - 1) {
        throw error;
      }
      await sleep(EMAIL_RETRY_DELAYS_MS[attempt] ?? 15_000);
    }
  }
  throw lastError;
}
