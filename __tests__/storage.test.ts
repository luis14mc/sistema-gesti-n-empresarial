import { afterEach, describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalStorageAdapter } from '../src/lib/storage/local';
import { getStorage, resetStorageForTests } from '../src/lib/storage';

describe('LocalStorageAdapter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sge-storage-'));
    resetStorageForTests();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    resetStorageForTests();
  });

  it('stores a file and returns a relative URL', async () => {
    const adapter = new LocalStorageAdapter({
      baseDir: tmpDir,
      publicPrefix: '/uploads',
    });

    const result = await adapter.put({
      prefix: 'oficios',
      originalName: 'memo.pdf',
      mimeType: 'application/pdf',
      size: 12,
      buffer: Buffer.from('hello world'),
    });

    expect(result.url).toMatch(/^\/uploads\/oficios\/\d{4}\/\d{2}\//);
    expect(result.filename).toMatch(/\.pdf$/);
    expect(result.size).toBe(12);
    expect(existsSync(join(tmpDir, result.url.replace(/^\//, '')))).toBe(true);
  });

  it('sanitizes filenames with special characters', async () => {
    const adapter = new LocalStorageAdapter({
      baseDir: tmpDir,
      publicPrefix: '/uploads',
    });

    const result = await adapter.put({
      prefix: 'equipment/assignments',
      originalName: 'acta entrega (final) 2026.pdf',
      mimeType: 'application/pdf',
      size: 8,
      buffer: Buffer.from('xyz12345'),
      desiredName: 'acta entrega (final) 2026.pdf',
    });

    expect(result.filename).not.toMatch(/[ ?%*:|"<>]/);
    expect(existsSync(join(tmpDir, result.key))).toBe(true);
  });

  it('remove() is idempotent (does not throw on missing key)', async () => {
    const adapter = new LocalStorageAdapter({ baseDir: tmpDir, publicPrefix: '/uploads' });
    await expect(adapter.remove('no/existe/path.pdf')).resolves.toBeUndefined();
    await expect(adapter.remove('no/existe/path.pdf')).resolves.toBeUndefined();
  });

  it('rejects keys that escape the configured storage root', async () => {
    const adapter = new LocalStorageAdapter({ baseDir: tmpDir, publicPrefix: '/uploads' });
    await expect(adapter.get('../secret.txt')).rejects.toThrow('INVALID_STORAGE_KEY');
    await expect(adapter.remove('../secret.txt')).rejects.toThrow('INVALID_STORAGE_KEY');
  });

  it('round-trip: put then read back via fs', async () => {
    const adapter = new LocalStorageAdapter({
      baseDir: tmpDir,
      publicPrefix: '/uploads',
    });

    const payload = Buffer.from('contenido del PDF v2');
    const result = await adapter.put({
      prefix: 'oficios',
      originalName: 'foo.pdf',
      mimeType: 'application/pdf',
      size: payload.length,
      buffer: payload,
    });

    const onDisk = readFileSync(join(tmpDir, result.key));
    expect(onDisk.toString()).toBe('contenido del PDF v2');
  });

  it('getStorage() with STORAGE_DRIVER=local returns LocalStorageAdapter', () => {
    process.env.STORAGE_DRIVER = 'local';
    process.env.LOCAL_STORAGE_PATH = tmpDir;
    const storage = getStorage();
    expect(storage.driverName).toBe('local');
  });

  it('getStorage() with STORAGE_DRIVER=s3 throws when env vars are missing', () => {
    delete process.env.STORAGE_DRIVER;
    delete process.env.S3_BUCKET;
    delete process.env.AWS_REGION;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    process.env.STORAGE_DRIVER = 's3';
    resetStorageForTests();
    expect(() => getStorage()).toThrowError(/S3_BUCKET|AWS_REGION/);
    process.env.STORAGE_DRIVER = 'local';
    resetStorageForTests();
  });
});
