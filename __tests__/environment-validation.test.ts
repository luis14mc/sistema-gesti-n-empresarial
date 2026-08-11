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

  it('uses task-role credentials in protected environments', () => {
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
