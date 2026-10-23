import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalStorageAdapter } from '@/platform/storage/local';
import { buildObjectKey } from '@/platform/storage/object-key';

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class MockS3Client {
    send = sendMock;
  },
  PutObjectCommand: class PutObjectCommand {
    constructor(input: Record<string, unknown>) {
      Object.assign(this, input);
    }
  },
  DeleteObjectCommand: class DeleteObjectCommand {},
  HeadBucketCommand: class HeadBucketCommand {},
  GetObjectCommand: class GetObjectCommand {},
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://signed.example/object'),
}));

describe('buildObjectKey', () => {
  it('generates uuid-prefixed filenames up to 120 characters', () => {
    const longName = `${'a'.repeat(200)}.PDF`;
    const { filename } = buildObjectKey('organizations/org/oficios', {
      prefix: 'organizations/org/oficios',
      originalName: longName,
      mimeType: 'application/pdf',
      size: 1,
      buffer: Buffer.from('x'),
      desiredName: longName,
    });
    expect(filename.length).toBeLessThanOrEqual(120);
    expect(filename).toMatch(/^[0-9a-f-]{36}-/);
    expect(filename.toLowerCase()).toMatch(/\.pdf$/);
  });

  it('uses desiredName as-is when overwrite is true', () => {
    const { filename } = buildObjectKey('organizations/org/payroll/2026/1', {
      prefix: 'organizations/org/payroll/2026/1',
      originalName: 'emp-1.pdf',
      mimeType: 'application/pdf',
      size: 1,
      buffer: Buffer.from('x'),
      desiredName: 'emp-1.pdf',
      overwrite: true,
    });
    expect(filename).toBe('emp-1.pdf');
  });
});

describe('LocalStorageAdapter unique keys', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sge-storage-unique-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('stores two uploads with the same desiredName under distinct keys', async () => {
    const adapter = new LocalStorageAdapter({
      baseDir: tmpDir,
      publicPrefix: '/uploads',
    });

    const input = {
      prefix: 'organizations/org-a/oficios',
      originalName: 'memo.pdf',
      mimeType: 'application/pdf',
      desiredName: 'memo.pdf',
    };

    const first = await adapter.put({
      ...input,
      size: 5,
      buffer: Buffer.from('first'),
    });
    const second = await adapter.put({
      ...input,
      size: 6,
      buffer: Buffer.from('second'),
    });

    expect(first.key).not.toBe(second.key);
    expect(readFileSync(join(tmpDir, first.key.replace(/^\//, ''))).toString()).toBe('first');
    expect(readFileSync(join(tmpDir, second.key.replace(/^\//, ''))).toString()).toBe('second');
  });

  it('overwrite:true replaces object content at the same key', async () => {
    const adapter = new LocalStorageAdapter({
      baseDir: tmpDir,
      publicPrefix: '/uploads',
    });

    const base = {
      prefix: 'organizations/org-a/payroll/2026/10',
      originalName: 'worker-1.pdf',
      mimeType: 'application/pdf',
      desiredName: 'worker-1.pdf',
      overwrite: true as const,
    };

    const first = await adapter.put({ ...base, size: 3, buffer: Buffer.from('v1') });
    const second = await adapter.put({ ...base, size: 3, buffer: Buffer.from('v2') });

    expect(first.key).toBe(second.key);
    expect(readFileSync(join(tmpDir, first.key.replace(/^\//, ''))).toString()).toBe('v2');
  });
});

describe('S3StorageAdapter put preconditions', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('retries once with a new uuid after 412 PreconditionFailed', async () => {
    const { S3StorageAdapter } = await import('@/platform/storage/s3');
    const adapter = new S3StorageAdapter({
      bucket: 'bucket',
      region: 'auto',
      endpoint: 'https://acct.r2.cloudflarestorage.com',
    });

    sendMock
      .mockRejectedValueOnce({ name: 'PreconditionFailed', $metadata: { httpStatusCode: 412 } })
      .mockResolvedValueOnce({});

    const result = await adapter.put({
      prefix: 'organizations/org/oficios',
      originalName: 'dup.pdf',
      mimeType: 'application/pdf',
      size: 4,
      buffer: Buffer.from('data'),
      desiredName: 'dup.pdf',
    });

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(result.key).toMatch(/organizations\/org\/oficios\/\d{4}\/\d{2}\/[0-9a-f-]{36}-dup\.pdf$/);
    expect(sendMock.mock.calls[0][0]).toMatchObject({ IfNoneMatch: '*' });
  });
});
