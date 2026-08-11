import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getStorage, resetStorageForTests } from '../src/lib/storage';

describe('Storage factory + S3 driver configuration', () => {
  let tmpDir: string;
  const storageEnvironmentKeys = [
    'STORAGE_DRIVER', 'LOCAL_STORAGE_PATH', 'S3_BUCKET', 'AWS_REGION',
    'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
    'S3_ENDPOINT', 'S3_FORCE_PATH_STYLE', 'S3_PUBLIC_URL', 'S3_PRESIGNED_TTL_SECONDS',
  ] as const;

  beforeEach(() => {
    storageEnvironmentKeys.forEach((key) => delete process.env[key]);
    tmpDir = mkdtempSync(join(tmpdir(), 'sge-factory-'));
    resetStorageForTests();
    process.env.APP_ENV = 'test';
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    resetStorageForTests();
    storageEnvironmentKeys.forEach((key) => delete process.env[key]);
  });

  it('returns LocalStorageAdapter by default (no STORAGE_DRIVER)', () => {
    delete process.env.STORAGE_DRIVER;
    delete process.env.S3_BUCKET;
    expect(getStorage().driverName).toBe('local');
  });

  it('returns LocalStorageAdapter explicitly with STORAGE_DRIVER=local', () => {
    process.env.STORAGE_DRIVER = 'local';
    process.env.LOCAL_STORAGE_PATH = tmpDir;
    expect(getStorage().driverName).toBe('local');
  });

  it('throws on S3 driver when AWS_REGION is missing', () => {
    process.env.STORAGE_DRIVER = 's3';
    process.env.S3_BUCKET = 'test-bucket';
    delete process.env.AWS_REGION;
    expect(() => getStorage()).toThrowError(/AWS_REGION/);
  });

  it('instantiates S3StorageAdapter with the AWS credential chain', () => {
    process.env.STORAGE_DRIVER = 's3';
    process.env.S3_BUCKET = 'test-bucket';
    process.env.AWS_REGION = 'us-east-2';
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    resetStorageForTests();

    const storage = getStorage();
    expect(storage.driverName).toBe('s3');

    process.env.STORAGE_DRIVER = 'local';
    process.env.LOCAL_STORAGE_PATH = tmpDir;
    resetStorageForTests();
  });

  it('read S3_PRESIGNED_TTL_SECONDS as number or defaults to 900', () => {
    process.env.STORAGE_DRIVER = 's3';
    process.env.S3_BUCKET = 'b';
    process.env.AWS_REGION = 'us-east-2';
    process.env.AWS_ACCESS_KEY_ID = 'k';
    process.env.AWS_SECRET_ACCESS_KEY = 's';
    process.env.S3_PRESIGNED_TTL_SECONDS = '1800';
    resetStorageForTests();

    getStorage();
    expect(process.env.S3_PRESIGNED_TTL_SECONDS).toBe('1800');

    delete process.env.S3_PRESIGNED_TTL_SECONDS;
    resetStorageForTests();
  });
});
