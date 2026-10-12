import { describe, expect, it, vi } from 'vitest';
import { buildS3ClientConfig, isR2Endpoint } from '@/lib/storage/s3';

const { s3ClientMock } = vi.hoisted(() => ({
  s3ClientMock: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: s3ClientMock,
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  HeadBucketCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://signed.example/object'),
}));

describe('S3 client configuration', () => {
  it('detects Cloudflare R2 endpoints', () => {
    expect(isR2Endpoint('https://abc123.r2.cloudflarestorage.com')).toBe(true);
    expect(isR2Endpoint('https://s3.amazonaws.com')).toBe(false);
  });

  it('uses auto region, path-style, and checksum policy for R2', () => {
    const config = buildS3ClientConfig({
      bucket: 'cni-sge-files',
      region: 'us-east-2',
      endpoint: 'https://account123.r2.cloudflarestorage.com',
      accessKeyId: 'key',
      secretAccessKey: 'secret',
    });
    expect(config).toMatchObject({
      region: 'auto',
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  });

  it('keeps AWS settings when no R2 endpoint is configured', () => {
    const config = buildS3ClientConfig({
      bucket: 'aws-bucket',
      region: 'us-east-2',
      forcePathStyle: false,
    });
    expect(config.region).toBe('us-east-2');
    expect(config.forcePathStyle).toBe(false);
    expect(config.requestChecksumCalculation).toBeUndefined();
  });

  it('constructs S3StorageAdapter with R2 client options', async () => {
    s3ClientMock.mockClear();
    const { S3StorageAdapter } = await import('@/lib/storage/s3');
    new S3StorageAdapter({
      bucket: 'cni-sge-files-staging',
      region: 'auto',
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      accessKeyId: 'id',
      secretAccessKey: 'secret',
    });
    expect(s3ClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'auto',
        forcePathStyle: true,
        requestChecksumCalculation: 'WHEN_REQUIRED',
      }),
    );
  });
});
