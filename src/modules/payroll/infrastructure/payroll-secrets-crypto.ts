import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { z } from 'zod';

const payrollSecretsKeySchema = z
  .string()
  .min(1)
  .refine((raw) => Buffer.from(raw.trim(), 'base64').length === 32, {
    message: 'PAYROLL_SECRETS_KEY_INVALID',
  })
  .transform((raw) => Buffer.from(raw.trim(), 'base64'));

export function isPayrollSecretsKeyConfigured(source: Record<string, string | undefined> = process.env): boolean {
  const raw = source.PAYROLL_SECRETS_KEY?.trim();
  if (!raw) return false;
  return payrollSecretsKeySchema.safeParse(raw).success;
}

export function getPayrollSecretsKey(source: Record<string, string | undefined> = process.env): Buffer {
  const raw = source.PAYROLL_SECRETS_KEY?.trim();
  if (!raw) {
    throw new Error('PAYROLL_SECRETS_KEY_MISSING');
  }
  return payrollSecretsKeySchema.parse(raw);
}

/** AES-256-GCM: base64(iv).base64(tag).base64(ciphertext) */
export function encryptPayrollSecret(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptPayrollSecret(payload: string, key: Buffer): string {
  const parts = payload.split('.');
  if (parts.length !== 3) {
    throw new Error('PAYROLL_SECRET_DECRYPT_FAILED');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
