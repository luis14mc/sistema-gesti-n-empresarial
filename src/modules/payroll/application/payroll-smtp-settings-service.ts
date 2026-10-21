import { prisma } from '@/lib/prisma';
import { EmailNotConfiguredError } from '@/platform/email/errors';
import {
  getPublicSmtpStatus,
  getSmtpRuntimeConfig,
  type PublicSmtpStatus,
  type SmtpRuntimeConfig,
} from '@/platform/email/smtp-config';
import {
  decryptPayrollSecret,
  encryptPayrollSecret,
  getPayrollSecretsKey,
  isPayrollSecretsKeyConfigured,
} from '@/modules/payroll/infrastructure/payroll-secrets-crypto';
import { PayrollDomainError } from '@/modules/payroll/domain';

export const PAYROLL_SMTP_DEFAULTS = {
  host: 'smtp.office365.com',
  port: 587,
  senderName: 'Servicios Online',
  fromAddress: 'notificaciones@cni.hn',
} as const;

export type PayrollSmtpPublicSettings = Readonly<{
  source: 'database' | 'environment';
  secretsKeyConfigured: boolean;
  configured: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  senderName: string;
  fromAddress: string;
  from: string;
  replyTo: string | null;
  passwordConfigured: boolean;
}>;

function smtpSecureFromPort(port: number): boolean {
  return port === 465;
}

function formatFrom(senderName: string, fromAddress: string): string {
  return `${senderName} <${fromAddress}>`;
}

function resolveDbRowPassword(
  row: { passwordEncrypted: string | null },
  env: Record<string, string | undefined>,
): string | null {
  if (row.passwordEncrypted) {
    try {
      return decryptPayrollSecret(row.passwordEncrypted, getPayrollSecretsKey());
    } catch {
      return null;
    }
  }
  try {
    return getSmtpRuntimeConfig(env).SMTP_PASSWORD;
  } catch {
    return null;
  }
}

function runtimeFromDbRow(
  row: {
    host: string;
    port: number;
    username: string;
    passwordEncrypted: string | null;
    senderName: string;
    fromAddress: string;
    replyTo: string | null;
  },
  env: Record<string, string | undefined> = process.env,
): SmtpRuntimeConfig | null {
  const password = resolveDbRowPassword(row, env);
  if (!password) return null;
  const secure = smtpSecureFromPort(row.port);
  return {
    EMAIL_TRANSPORT: 'smtp',
    SMTP_HOST: row.host,
    SMTP_PORT: row.port,
    SMTP_SECURE: secure,
    SMTP_USER: row.username,
    SMTP_PASSWORD: password,
    SMTP_FROM: formatFrom(row.senderName, row.fromAddress),
    SMTP_REPLY_TO: row.replyTo ?? undefined,
  };
}

export async function getPayrollSmtpPublicSettings(
  organizationId: string,
  env: Record<string, string | undefined> = process.env,
): Promise<PayrollSmtpPublicSettings> {
  const secretsKeyConfigured = isPayrollSecretsKeyConfigured(env);
  const row = await prisma.payrollSmtpSettings.findUnique({ where: { organizationId } });

  if (row) {
    const secure = smtpSecureFromPort(row.port);
    const envPassword = getPublicSmtpStatus(env).passwordConfigured;
    const passwordConfigured = Boolean(row.passwordEncrypted) || envPassword;
    const runtime = runtimeFromDbRow(row, env);
    return {
      source: 'database',
      secretsKeyConfigured,
      configured: Boolean(runtime),
      host: row.host,
      port: row.port,
      secure,
      username: row.username,
      senderName: row.senderName,
      fromAddress: row.fromAddress,
      from: formatFrom(row.senderName, row.fromAddress),
      replyTo: row.replyTo,
      passwordConfigured,
    };
  }

  const envStatus = getPublicSmtpStatus(env);
  const fromMatch = (envStatus.from ?? '').match(/^(.+?)\s*<([^>]+)>$/);
  return {
    source: 'environment',
    secretsKeyConfigured,
    configured: envStatus.configured,
    host: envStatus.host ?? PAYROLL_SMTP_DEFAULTS.host,
    port: envStatus.port,
    secure: envStatus.secure,
    username: envStatus.user ?? '',
    senderName: fromMatch?.[1]?.trim() ?? PAYROLL_SMTP_DEFAULTS.senderName,
    fromAddress: fromMatch?.[2]?.trim() ?? PAYROLL_SMTP_DEFAULTS.fromAddress,
    from: envStatus.from,
    replyTo: envStatus.replyTo,
    passwordConfigured: envStatus.passwordConfigured,
  };
}

export async function getOrganizationSmtpRuntimeConfig(
  organizationId: string,
  env: Record<string, string | undefined> = process.env,
): Promise<SmtpRuntimeConfig> {
  const row = await prisma.payrollSmtpSettings.findUnique({ where: { organizationId } });
  if (row) {
    const runtime = runtimeFromDbRow(row, env);
    if (runtime) return runtime;
  }
  return getSmtpRuntimeConfig(env);
}

export async function getOrganizationPublicSmtpStatus(
  organizationId: string,
  env: Record<string, string | undefined> = process.env,
): Promise<PublicSmtpStatus & { source: 'database' | 'environment' }> {
  const publicSettings = await getPayrollSmtpPublicSettings(organizationId, env);
  return {
    transport: 'smtp',
    configured: publicSettings.configured,
    host: publicSettings.host,
    port: publicSettings.port,
    secure: publicSettings.secure,
    user: publicSettings.username || null,
    from: publicSettings.from,
    replyTo: publicSettings.replyTo,
    passwordConfigured: publicSettings.passwordConfigured,
    source: publicSettings.source,
  };
}

export type UpsertPayrollSmtpInput = {
  host: string;
  port: number;
  username: string;
  password?: string;
  senderName: string;
  fromAddress: string;
  replyTo?: string | null;
};

export async function upsertPayrollSmtpSettings(
  organizationId: string,
  userId: string,
  input: UpsertPayrollSmtpInput,
) {
  const existing = await prisma.payrollSmtpSettings.findUnique({ where: { organizationId } });
  const passwordTrimmed = input.password?.trim() ?? '';

  let passwordEncrypted = existing?.passwordEncrypted ?? null;
  if (passwordTrimmed) {
    if (!isPayrollSecretsKeyConfigured()) {
      throw new PayrollDomainError(
        'Falta PAYROLL_SECRETS_KEY en Railway',
        'PAYROLL_SECRETS_KEY_MISSING',
      );
    }
    passwordEncrypted = encryptPayrollSecret(passwordTrimmed, getPayrollSecretsKey());
  } else if (!existing?.passwordEncrypted) {
    const env = getPublicSmtpStatus();
    if (!env.passwordConfigured) {
      throw new PayrollDomainError(
        'Indique la contraseña SMTP o configure SMTP_PASSWORD en el entorno.',
        'PAYROLL_SMTP_PASSWORD_REQUIRED',
      );
    }
  }

  const data = {
    host: input.host,
    port: input.port,
    username: input.username,
    passwordEncrypted,
    senderName: input.senderName,
    fromAddress: input.fromAddress,
    replyTo: input.replyTo ?? null,
    updatedById: userId,
  };

  if (existing) {
    return prisma.payrollSmtpSettings.update({
      where: { organizationId },
      data,
    });
  }
  return prisma.payrollSmtpSettings.create({
    data: { organizationId, ...data },
  });
}

export async function assertOrganizationSmtpConfigured(organizationId: string) {
  try {
    await getOrganizationSmtpRuntimeConfig(organizationId);
  } catch (error) {
    if (error instanceof EmailNotConfiguredError) {
      throw error;
    }
    throw error;
  }
}
