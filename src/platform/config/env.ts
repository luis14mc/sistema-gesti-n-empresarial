import { z } from 'zod';

export const APPLICATION_ENVIRONMENTS = ['development', 'test', 'staging', 'production'] as const;
export type ApplicationEnvironment = (typeof APPLICATION_ENVIRONMENTS)[number];

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const optionalString = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.string().optional(),
);
const optionalUrl = z.preprocess(
  (value) => value === '' ? undefined : value,
  z.string().url().optional(),
);
const booleanString = (defaultValue: boolean) => z.enum(['true', 'false'])
  .default(String(defaultValue) as 'true' | 'false')
  .transform((value) => value === 'true');
const integerString = (defaultValue: number, minimum: number, maximum: number) => z.coerce.number()
  .int()
  .min(minimum)
  .max(maximum)
  .default(defaultValue);

const storageSchema = z.object({
  APP_ENV: z.enum(APPLICATION_ENVIRONMENTS),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_PATH: optionalString,
  S3_BUCKET: optionalString,
  AWS_REGION: optionalString,
  AWS_ACCESS_KEY_ID: optionalString,
  AWS_SECRET_ACCESS_KEY: optionalString,
  AWS_SESSION_TOKEN: optionalString,
  S3_ENDPOINT: optionalUrl,
  S3_FORCE_PATH_STYLE: booleanString(false),
  S3_PUBLIC_URL: optionalUrl,
  S3_PRESIGNED_TTL_SECONDS: integerString(900, 60, 86_400),
}).superRefine((value, context) => {
  if (value.STORAGE_DRIVER === 's3') {
    if (!value.S3_BUCKET) context.addIssue({ code: 'custom', path: ['S3_BUCKET'], message: 'Required for S3 storage.' });
    if (!value.AWS_REGION) context.addIssue({ code: 'custom', path: ['AWS_REGION'], message: 'Required for S3 storage.' });
  }

  const hasAccessKey = Boolean(value.AWS_ACCESS_KEY_ID);
  const hasSecretKey = Boolean(value.AWS_SECRET_ACCESS_KEY);
  if (hasAccessKey !== hasSecretKey) {
    context.addIssue({ code: 'custom', path: ['AWS_ACCESS_KEY_ID'], message: 'Static AWS credentials must be supplied as a complete pair.' });
  }

  if (value.APP_ENV === 'staging' || value.APP_ENV === 'production') {
    if (value.STORAGE_DRIVER !== 's3') context.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'Durable S3 storage is required.' });
    if (hasAccessKey || hasSecretKey || value.AWS_SESSION_TOKEN) {
      context.addIssue({ code: 'custom', path: ['AWS_ACCESS_KEY_ID'], message: 'Use an IAM task role instead of static AWS credentials.' });
    }
    if (value.S3_ENDPOINT) context.addIssue({ code: 'custom', path: ['S3_ENDPOINT'], message: 'Custom S3 endpoints are not allowed.' });
    if (value.S3_PUBLIC_URL) context.addIssue({ code: 'custom', path: ['S3_PUBLIC_URL'], message: 'Protected storage must not expose a public object base URL.' });
  }
});

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  APP_ENV: z.enum(APPLICATION_ENVIRONMENTS),
  DATABASE_URL: z.string().refine(
    (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
    'Must be a PostgreSQL connection URL.',
  ),
  APP_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  COOKIE_SECURE: booleanString(false),
  CORS_ORIGINS: z.string().default('')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.string().url())),
  PUPPETEER_EXECUTABLE_PATH: optionalString,
  PUPPETEER_DISABLE_SANDBOX: booleanString(false),
  PDF_ENGINE_REQUIRED: booleanString(true),
  DATABASE_POOL_MAX: integerString(10, 1, 100),
  DATABASE_IDLE_TIMEOUT_MS: integerString(30_000, 1_000, 600_000),
  DATABASE_CONNECTION_TIMEOUT_MS: integerString(5_000, 500, 60_000),
  HEALTH_CHECK_TIMEOUT_MS: integerString(3_000, 250, 30_000),
  WORKER_ENABLED: booleanString(false),
  WORKER_PAUSED: booleanString(false),
  WORKER_POLL_INTERVAL_MS: integerString(2_000, 250, 60_000),
  WORKER_SHUTDOWN_TIMEOUT_MS: integerString(25_000, 1_000, 120_000),
}).superRefine((value, context) => {
  const protectedEnvironment = value.APP_ENV === 'staging' || value.APP_ENV === 'production';
  if (protectedEnvironment && value.NODE_ENV !== 'production') {
    context.addIssue({ code: 'custom', path: ['NODE_ENV'], message: 'Staging and production require NODE_ENV=production.' });
  }
  if (protectedEnvironment && !value.APP_URL.startsWith('https://')) {
    context.addIssue({ code: 'custom', path: ['APP_URL'], message: 'HTTPS is required.' });
  }
  if (protectedEnvironment && !value.COOKIE_SECURE) {
    context.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'Secure cookies are required.' });
  }
  if (protectedEnvironment && value.PDF_ENGINE_REQUIRED && !value.PUPPETEER_EXECUTABLE_PATH) {
    context.addIssue({ code: 'custom', path: ['PUPPETEER_EXECUTABLE_PATH'], message: 'The managed browser path is required.' });
  }
});

const databaseSchema = z.object({
  DATABASE_URL: z.string().refine(
    (value) => value.startsWith('postgresql://') || value.startsWith('postgres://'),
    'Must be a PostgreSQL connection URL.',
  ),
  DATABASE_POOL_MAX: integerString(10, 1, 100),
  DATABASE_IDLE_TIMEOUT_MS: integerString(30_000, 1_000, 600_000),
  DATABASE_CONNECTION_TIMEOUT_MS: integerString(5_000, 500, 60_000),
});

export type ServerEnvironment = z.infer<typeof serverSchema> & z.infer<typeof storageSchema>;
export type PublicEnvironment = Readonly<{ NEXT_PUBLIC_API_URL?: string }>;
export type WorkerEnvironment = ServerEnvironment & Readonly<{
  WORKER_ENABLED: true;
}>;

export class EnvironmentValidationError extends Error {
  readonly code = 'INVALID_ENVIRONMENT_CONFIGURATION';

  constructor(readonly variables: readonly string[]) {
    super(`Invalid environment configuration: ${variables.join(', ')}`);
    this.name = 'EnvironmentValidationError';
  }
}

function inferredAppEnvironment(source: EnvironmentSource): ApplicationEnvironment | undefined {
  if (source.APP_ENV) return source.APP_ENV as ApplicationEnvironment;
  if (source.NODE_ENV === 'test') return 'test';
  if (source.NODE_ENV !== 'production') return 'development';
  return undefined;
}

function normalizedSource(source: EnvironmentSource): Record<string, string | undefined> {
  const appEnvironment = inferredAppEnvironment(source);
  return {
    ...source,
    APP_ENV: appEnvironment,
    NODE_ENV: source.NODE_ENV ?? 'development',
    APP_URL: source.APP_URL ?? (appEnvironment === 'development' || appEnvironment === 'test' ? 'http://localhost:3000' : undefined),
  };
}

function validationError(error: z.ZodError): EnvironmentValidationError {
  const variables = [...new Set(error.issues.map((issue) => issue.path.join('.') || 'environment'))];
  return new EnvironmentValidationError(variables);
}

export function validateStorageEnvironment(source: EnvironmentSource): z.infer<typeof storageSchema> {
  const parsed = storageSchema.safeParse(normalizedSource(source));
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

export function validateDatabaseEnvironment(source: EnvironmentSource): z.infer<typeof databaseSchema> {
  const parsed = databaseSchema.safeParse(source);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

export function validateServerEnvironment(source: EnvironmentSource): ServerEnvironment {
  const normalized = normalizedSource(source);
  const [server, storage] = [serverSchema.safeParse(normalized), storageSchema.safeParse(normalized)];
  if (!server.success || !storage.success) {
    const issues = [
      ...(server.success ? [] : server.error.issues),
      ...(storage.success ? [] : storage.error.issues),
    ];
    throw validationError(new z.ZodError(issues));
  }
  return { ...server.data, ...storage.data };
}

export function validatePublicEnvironment(source: EnvironmentSource): PublicEnvironment {
  const parsed = z.object({ NEXT_PUBLIC_API_URL: optionalUrl }).safeParse(source);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

export function validateWorkerEnvironment(source: EnvironmentSource): WorkerEnvironment {
  const environment = validateServerEnvironment(source);
  if (!environment.WORKER_ENABLED) throw new EnvironmentValidationError(['WORKER_ENABLED']);
  return { ...environment, WORKER_ENABLED: true };
}

let cachedServerEnvironment: ServerEnvironment | null = null;

export function getServerEnvironment(): ServerEnvironment {
  cachedServerEnvironment ??= validateServerEnvironment(process.env);
  return cachedServerEnvironment;
}

export function resetEnvironmentForTests(): void {
  cachedServerEnvironment = null;
}
