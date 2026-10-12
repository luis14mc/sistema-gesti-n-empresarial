import { describe, expect, it } from 'vitest';
import {
  validatePublicEnvironment,
  validateServerEnvironment,
  validateStorageEnvironment,
  validateWorkerEnvironment,
} from '@/platform/config/env';

const productionEnvironment = {
  NODE_ENV: 'production',
  APP_ENV: 'production',
  DATABASE_URL: 'postgresql://user:password@database.example.com/sge',
  APP_URL: 'https://sge.example.com',
  JWT_SECRET: 'production-secret-with-more-than-32-characters',
  COOKIE_SECURE: 'true',
  STORAGE_DRIVER: 's3',
  S3_BUCKET: 'sge-production',
  AWS_REGION: 'us-east-2',
  PUPPETEER_EXECUTABLE_PATH: '/usr/bin/chromium',
};

describe('production environment validation', () => {
  it('fails startup when required production configuration is missing', () => {
    expect(() => validateServerEnvironment({
      NODE_ENV: 'production',
      APP_ENV: 'production',
    })).toThrow(/DATABASE_URL|APP_URL|JWT_SECRET/);
  });

  it('never accepts insecure production cookies or local storage', () => {
    expect(() => validateServerEnvironment({
      ...productionEnvironment,
      COOKIE_SECURE: 'false',
      STORAGE_DRIVER: 'local',
    })).toThrow(/COOKIE_SECURE|STORAGE_DRIVER/);
  });

  it('uses task-role credentials in protected environments without S3_ENDPOINT', () => {
    const environment = validateStorageEnvironment(productionEnvironment);
    expect(environment).toMatchObject({
      APP_ENV: 'production',
      STORAGE_DRIVER: 's3',
    });
    expect(environment.AWS_ACCESS_KEY_ID).toBeUndefined();
    expect(() => validateStorageEnvironment({
      ...productionEnvironment,
      AWS_ACCESS_KEY_ID: 'static-key',
      AWS_SECRET_ACCESS_KEY: 'static-secret',
    })).toThrow(/AWS_ACCESS_KEY_ID/);
  });

  it('allows Cloudflare R2 endpoint with static credentials in production', () => {
    const environment = validateStorageEnvironment({
      ...productionEnvironment,
      S3_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
      AWS_REGION: 'auto',
      AWS_ACCESS_KEY_ID: 'r2-access-key',
      AWS_SECRET_ACCESS_KEY: 'r2-secret-key',
    });
    expect(environment.S3_ENDPOINT).toBe('https://abc123.r2.cloudflarestorage.com');
    expect(environment.AWS_ACCESS_KEY_ID).toBe('r2-access-key');
  });

  it('rejects disallowed S3 endpoints in production', () => {
    expect(() => validateStorageEnvironment({
      ...productionEnvironment,
      S3_ENDPOINT: 'https://minio.internal:9000',
      AWS_ACCESS_KEY_ID: 'key',
      AWS_SECRET_ACCESS_KEY: 'secret',
    })).toThrow(/S3_ENDPOINT/);
  });

  it('requires R2 access keys when S3_ENDPOINT is set in production', () => {
    expect(() => validateStorageEnvironment({
      ...productionEnvironment,
      S3_ENDPOINT: 'https://abc123.r2.cloudflarestorage.com',
      AWS_REGION: 'auto',
    })).toThrow(/AWS_ACCESS_KEY_ID|Cloudflare R2/);
  });

  it('keeps public configuration separate from server secrets', () => {
    expect(validatePublicEnvironment({
      NEXT_PUBLIC_API_URL: 'https://api.example.com',
      JWT_SECRET: 'must-not-be-returned',
    })).toEqual({ NEXT_PUBLIC_API_URL: 'https://api.example.com' });
  });

  it('requires explicit worker activation', () => {
    expect(() => validateWorkerEnvironment(productionEnvironment)).toThrow(/WORKER_ENABLED/);
  });
});
