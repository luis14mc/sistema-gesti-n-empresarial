import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const GENERATED_PASSWORD_LENGTH = 16;

const HAS_LETTER = /[A-Za-zÁÉÍÓÚáéíóúÑñ]/;
const HAS_DIGIT = /\d/;

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (!HAS_LETTER.test(password)) {
    return 'La contraseña debe incluir al menos una letra.';
  }
  if (!HAS_DIGIT.test(password)) {
    return 'La contraseña debe incluir al menos un número.';
  }
  return null;
}

export const passwordPolicySchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  .refine((value) => HAS_LETTER.test(value), 'Debe incluir al menos una letra')
  .refine((value) => HAS_DIGIT.test(value), 'Debe incluir al menos un número');

const GENERATED_CHARSET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';

/** Cryptographically secure password for admin provisioning (16 chars). */
export function generateSecurePassword(length = GENERATED_PASSWORD_LENGTH): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += GENERATED_CHARSET[bytes[index]! % GENERATED_CHARSET.length];
  }
  if (!HAS_LETTER.test(result)) result = `A${result.slice(1)}`;
  if (!HAS_DIGIT.test(result)) result = `${result.slice(0, -1)}7`;
  return result;
}
