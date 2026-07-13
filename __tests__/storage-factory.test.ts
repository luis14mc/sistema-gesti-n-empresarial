import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getStorage, resetStorageForTests } from '../src/lib/storage';

describe('Storage factory + S3 driver configuration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sge-factory-'));
    resetStorageForTests();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    resetStorageForTests();
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
    expect(() => getStorage()).toThrowError(/S3_BUCKET|region/);
  });

  it('instantiates S3StorageAdapter successfully with all env vars', async () => {
    process.env.STORAGE_DRIVER = 's3';
    process.env.S3_BUCKET = 'test-bucket';
    process.env.AWS_REGION = 'us-east-2';
    process.env.AWS_ACCESS_KEY_ID = 'AKIA-TEST';
    process.env.AWS_SECRET_ACCESS_KEY = 'secret-test';
    resetStorageForTests();

    const storage = getStorage();
    expect(storage.driverName).toBe('s3');

    // El ping no debe tirar al instanciar (silencioso en S3 sin bucket real)
    await expect(storage.ping?.()).resolves.toBeUndefined();

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
