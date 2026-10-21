import { getSmtpRuntimeConfig } from './smtp-config';
import { SmtpTransport } from './smtp-transport';
import type { EmailTransport } from './types';
import { getOrganizationSmtpRuntimeConfig } from '@/modules/payroll/application/payroll-smtp-settings-service';

export function createEmailTransport(source: Record<string, string | undefined> = process.env): EmailTransport {
  const config = getSmtpRuntimeConfig(source);
  return new SmtpTransport(config);
}

export async function createEmailTransportForOrganization(
  organizationId: string,
  source: Record<string, string | undefined> = process.env,
): Promise<EmailTransport> {
  const config = await getOrganizationSmtpRuntimeConfig(organizationId, source);
  return new SmtpTransport(config);
}
