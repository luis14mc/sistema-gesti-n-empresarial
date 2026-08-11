import { IntegrationSecretReferenceError } from '../../domain/integration-errors';
import type { SecretStore, SecretValue } from './types';
import { isSecretKey, normalizeSecretReference } from './types';

const STORE = new Map<string, SecretValue>();
const PREFIX_INDEX = new Map<string, Set<string>>();

function indexAdd(reference: string): void {
  const parts = reference.split(':');
  if (parts.length < 3) return;
  const prefix = `${parts[0]}:${parts[1]}:`;
  if (!PREFIX_INDEX.has(prefix)) {
    PREFIX_INDEX.set(prefix, new Set());
  }
  PREFIX_INDEX.get(prefix)!.add(reference);
}

function indexRemove(reference: string): void {
  const parts = reference.split(':');
  if (parts.length < 3) return;
  const prefix = `${parts[0]}:${parts[1]}:`;
  const set = PREFIX_INDEX.get(prefix);
  if (!set) return;
  set.delete(reference);
  if (set.size === 0) PREFIX_INDEX.delete(prefix);
}

function validateValue(value: SecretValue): SecretValue {
  if (!value || typeof value !== 'object') {
    throw new IntegrationSecretReferenceError('Secret payload must be an object of key/value pairs.');
  }
  for (const key of Object.keys(value)) {
    if (!isSecretKey(key)) {
      throw new IntegrationSecretReferenceError(`Invalid secret key: ${key}`);
    }
    if (typeof value[key] !== 'string') {
      throw new IntegrationSecretReferenceError(`Secret value for ${key} must be a string.`);
    }
    if (value[key].length === 0) {
      throw new IntegrationSecretReferenceError(`Secret value for ${key} cannot be empty.`);
    }
    if (value[key].length > 4096) {
      throw new IntegrationSecretReferenceError(`Secret value for ${key} exceeds 4096 characters.`);
    }
  }
  return Object.freeze({ ...value });
}

export const inMemorySecretStore: SecretStore = {
  async read(reference: string): Promise<SecretValue> {
    const normalized = normalizeSecretReference(reference);
    const value = STORE.get(normalized);
    if (!value) {
      throw new IntegrationSecretReferenceError(`No secret material for ${normalized}.`, normalized);
    }
    return value;
  },
  async rotate(reference: string, value: SecretValue): Promise<void> {
    const normalized = normalizeSecretReference(reference);
    const safe = validateValue(value);
    if (!STORE.has(normalized)) {
      indexAdd(normalized);
    }
    STORE.set(normalized, safe);
  },
  async delete(reference: string): Promise<void> {
    const normalized = normalizeSecretReference(reference);
    if (STORE.delete(normalized)) {
      indexRemove(normalized);
    }
  },
  async listReferences(prefix: string): Promise<readonly string[]> {
    return Array.from(PREFIX_INDEX.get(prefix) ?? []);
  },
};

export function resetInMemorySecretStore(): void {
  STORE.clear();
  PREFIX_INDEX.clear();
}
