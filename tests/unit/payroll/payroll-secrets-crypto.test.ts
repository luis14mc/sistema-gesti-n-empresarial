import { describe, expect, it } from 'vitest';
import {
  decryptPayrollSecret,
  encryptPayrollSecret,
  getPayrollSecretsKey,
  isPayrollSecretsKeyConfigured,
} from '@/modules/payroll/infrastructure/payroll-secrets-crypto';

const TEST_KEY_B64 = Buffer.alloc(32, 7).toString('base64');

describe('payroll-secrets-crypto', () => {
  it('round-trips encryption with PAYROLL_SECRETS_KEY', () => {
    const env = { PAYROLL_SECRETS_KEY: TEST_KEY_B64 };
    expect(isPayrollSecretsKeyConfigured(env)).toBe(true);
    const key = getPayrollSecretsKey(env);
    const cipher = encryptPayrollSecret('smtp-secret-123', key);
    expect(cipher).not.toContain('smtp-secret');
    expect(decryptPayrollSecret(cipher, key)).toBe('smtp-secret-123');
  });

  it('rejects invalid key length', () => {
    expect(isPayrollSecretsKeyConfigured({ PAYROLL_SECRETS_KEY: Buffer.alloc(16).toString('base64') })).toBe(
      false,
    );
  });
});
