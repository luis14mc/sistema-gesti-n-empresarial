import { getSmtpRuntimeConfig } from './smtp-config';
import { SmtpTransport } from './smtp-transport';
import type { EmailTransport } from './types';

export function createEmailTransport(source: Record<string, string | undefined> = process.env): EmailTransport {
  const config = getSmtpRuntimeConfig(source);
  return new SmtpTransport(config);
}
