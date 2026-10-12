#!/usr/bin/env tsx
/**
 * Verifies S3/R2 credentials and bucket access (HeadBucket, put, get, signed URL, delete).
 * Run against Railway: `railway run pnpm storage:smoke`
 */
import { randomUUID } from 'crypto';
import { validateStorageEnvironment } from '@/platform/config/env';
import { S3StorageAdapter } from '@/lib/storage/s3';

async function main(): Promise<void> {
  const environment = validateStorageEnvironment(process.env);
  if (environment.STORAGE_DRIVER !== 's3') {
    console.error('[storage-smoke] STORAGE_DRIVER must be s3');
    process.exit(1);
  }

  const adapter = new S3StorageAdapter({
    bucket: environment.S3_BUCKET!,
    region: environment.AWS_REGION!,
    accessKeyId: environment.AWS_ACCESS_KEY_ID,
    secretAccessKey: environment.AWS_SECRET_ACCESS_KEY,
    sessionToken: environment.AWS_SESSION_TOKEN,
    endpoint: environment.S3_ENDPOINT,
    forcePathStyle: environment.S3_FORCE_PATH_STYLE,
    keyPrefix: environment.APP_ENV,
    requireTenantPrefix: environment.APP_ENV === 'staging' || environment.APP_ENV === 'production',
    signedUrlTtlSeconds: environment.S3_PRESIGNED_TTL_SECONDS,
  });

  console.info('[storage-smoke] HeadBucket…');
  await adapter.ping();

  const body = Buffer.from(`storage-smoke ${new Date().toISOString()} ${randomUUID()}`, 'utf8');
  const prefix = 'organizations/storage-smoke/health-checks';

  console.info('[storage-smoke] put…');
  const stored = await adapter.put({
    prefix,
    originalName: 'smoke.txt',
    desiredName: `smoke-${Date.now()}.txt`,
    mimeType: 'text/plain',
    size: body.length,
    buffer: body,
  });

  console.info('[storage-smoke] get…');
  const fetched = await adapter.get(stored.key, 'text/plain');
  if (!fetched.buffer.equals(body)) {
    console.error('[storage-smoke] get content mismatch');
    process.exit(1);
  }

  console.info('[storage-smoke] signed URL…');
  const signedUrl = await adapter.getUrl(stored.key);
  if (!signedUrl.startsWith('https://')) {
    console.error('[storage-smoke] expected https signed URL');
    process.exit(1);
  }

  console.info('[storage-smoke] delete…');
  await adapter.remove(stored.key);

  console.info('[storage-smoke] OK', { key: stored.key, signedUrlPrefix: signedUrl.slice(0, 72) });
}

main().catch((error) => {
  console.error('[storage-smoke] FAILED', error instanceof Error ? error.message : error);
  process.exit(1);
});
