import { describe, expect, it } from 'vitest';
import {
  generateSecurePassword,
  GENERATED_PASSWORD_LENGTH,
  validatePasswordPolicy,
  PASSWORD_MIN_LENGTH,
} from '@/platform/security/password-policy';

describe('password policy', () => {
  it('rejects passwords shorter than minimum', () => {
    expect(validatePasswordPolicy('Ab1')).toMatch(/al menos/);
  });

  it('requires at least one letter and one digit', () => {
    expect(validatePasswordPolicy('12345678')).toMatch(/letra/);
    expect(validatePasswordPolicy('abcdefgh')).toMatch(/número/);
  });

  it('accepts valid passwords', () => {
    expect(validatePasswordPolicy('a'.repeat(PASSWORD_MIN_LENGTH - 1) + '1')).toBeNull();
  });

  it('generateSecurePassword produces policy-compliant 16-char passwords', () => {
    for (let i = 0; i < 20; i += 1) {
      const pwd = generateSecurePassword();
      expect(pwd.length).toBe(GENERATED_PASSWORD_LENGTH);
      expect(validatePasswordPolicy(pwd)).toBeNull();
    }
  });
});
