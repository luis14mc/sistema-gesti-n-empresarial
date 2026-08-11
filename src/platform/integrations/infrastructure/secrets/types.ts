import { IntegrationSecretReferenceError } from '../../domain/integration-errors';

export type SecretValue = Readonly<Record<string, string>>;

export interface SecretStore {
  read(reference: string): Promise<SecretValue>;
  rotate(reference: string, value: SecretValue): Promise<void>;
  delete(reference: string): Promise<void>;
  listReferences(prefix: string): Promise<readonly string[]>;
}

export const SECRET_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,127}$/u;
export const SECRET_REFERENCE_PATTERN = /^(secret|integration):(dev|prod):([A-Za-z0-9][A-Za-z0-9._:/+-]{0,127})$/u;

export function normalizeSecretReference(reference: string): string {
  const trimmed = reference?.trim();
  if (!trimmed) {
    throw new IntegrationSecretReferenceError('Secret reference is empty.');
  }
  if (!SECRET_REFERENCE_PATTERN.test(trimmed)) {
    throw new IntegrationSecretReferenceError(
      'Secret reference must follow secret:<env>:<key> (letters, digits, dot, colon, slash, underscore, dash, plus).',
      trimmed,
    );
  }
  return trimmed;
}

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}
