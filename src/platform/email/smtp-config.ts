import { z } from 'zod';
import { EmailNotConfiguredError } from './errors';

const smtpEnvSchema = z.object({
  EMAIL_TRANSPORT: z.enum(['smtp', 'graph']).default('smtp'),
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  SMTP_USER: z.string().trim().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  SMTP_FROM: z.string().trim().min(3).default('Recursos Humanos CNI <rrhh@cni.hn>'),
  SMTP_REPLY_TO: z.string().trim().email().optional().or(z.literal('').transform(() => undefined)),
});

export type SmtpRuntimeConfig = z.infer<typeof smtpEnvSchema> & {
  SMTP_HOST: string;
  SMTP_USER: string;
  SMTP_PASSWORD: string;
};

type EnvSource = Record<string, string | undefined>;

export function parseSmtpEnvironment(source: EnvSource = process.env) {
  return smtpEnvSchema.safeParse(source);
}

export function getSmtpRuntimeConfig(source: EnvSource = process.env): SmtpRuntimeConfig {
  const parsed = smtpEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new EmailNotConfiguredError();
  }
  if (parsed.data.EMAIL_TRANSPORT === 'graph') {
    // TODO: GraphTransport (Microsoft Graph) when EMAIL_TRANSPORT=graph
    throw new EmailNotConfiguredError('Microsoft Graph aún no está habilitado.');
  }
  const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = parsed.data;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
    throw new EmailNotConfiguredError();
  }
  return { ...parsed.data, SMTP_HOST, SMTP_USER, SMTP_PASSWORD };
}

export type PublicSmtpStatus = Readonly<{
  transport: 'smtp' | 'graph';
  configured: boolean;
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  from: string;
  replyTo: string | null;
  passwordConfigured: boolean;
}>;

export function getPublicSmtpStatus(source: EnvSource = process.env): PublicSmtpStatus {
  const parsed = smtpEnvSchema.safeParse(source);
  if (!parsed.success) {
    return {
      transport: 'smtp',
      configured: false,
      host: null,
      port: 587,
      secure: false,
      user: null,
      from: 'Recursos Humanos CNI <rrhh@cni.hn>',
      replyTo: null,
      passwordConfigured: false,
    };
  }
  const data = parsed.data;
  const configured = Boolean(
    data.EMAIL_TRANSPORT === 'smtp'
    && data.SMTP_HOST
    && data.SMTP_USER
    && data.SMTP_PASSWORD,
  );
  return {
    transport: data.EMAIL_TRANSPORT,
    configured,
    host: data.SMTP_HOST ?? null,
    port: data.SMTP_PORT,
    secure: data.SMTP_SECURE,
    user: data.SMTP_USER ?? null,
    from: data.SMTP_FROM,
    replyTo: data.SMTP_REPLY_TO ?? null,
    passwordConfigured: Boolean(data.SMTP_PASSWORD),
  };
}
