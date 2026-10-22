#!/usr/bin/env tsx
/**
 * Auditoría de solo lectura: objetos R2/local vs referencias en BD.
 * pnpm storage:audit
 */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import {
  ListObjectsV2Command,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { validateStorageEnvironment } from '@/platform/config/env';
import { buildS3ClientConfig, isR2Endpoint } from '@/platform/storage/s3';
import {
  collectDbStorageReferences,
  formatStorageAuditCsv,
  normalizeStorageKey,
  reconcileStorageAudit,
  type ListedStorageObject,
} from '@/platform/storage/storage-audit';
import { readdir, stat } from 'fs/promises';

async function listLocalObjects(baseDir: string, publicPrefix: string): Promise<ListedStorageObject[]> {
  const root = path.join(baseDir, publicPrefix.replace(/^\//, ''), 'organizations');
  const objects: ListedStorageObject[] = [];

  async function walk(dir: string, relative: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(abs, rel);
      } else if (entry.isFile()) {
        const info = await stat(abs);
        objects.push({
          key: `organizations/${rel.replace(/\\/g, '/')}`,
          size: info.size,
          lastModified: info.mtime.toISOString(),
        });
      }
    }
  }

  await walk(root, '');
  return objects;
}

async function listS3Objects(client: S3Client, bucket: string, prefix: string): Promise<ListedStorageObject[]> {
  const objects: ListedStorageObject[] = [];
  let token: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const item of page.Contents ?? []) {
      if (!item.Key) continue;
      let originalName: string | undefined;
      try {
        const head = await client.send(
          new HeadObjectCommand({ Bucket: bucket, Key: item.Key }),
        );
        const raw = head.Metadata?.['original-name'];
        if (raw) originalName = decodeURIComponent(raw);
      } catch {
        // metadata opcional
      }
      objects.push({
        key: item.Key,
        size: item.Size ?? 0,
        lastModified: item.LastModified?.toISOString() ?? '',
        originalName,
      });
    }
    token = page.NextContinuationToken;
  } while (token);

  return objects;
}

async function main(): Promise<void> {
  const environment = validateStorageEnvironment(process.env);
  const appEnv = environment.APP_ENV;
  const date = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(process.cwd(), 'reports', `storage-audit-${date}.csv`);

  let rawObjects: ListedStorageObject[] = [];

  if (environment.STORAGE_DRIVER === 's3') {
    const client = new S3Client(
      buildS3ClientConfig({
        bucket: environment.S3_BUCKET!,
        region: environment.AWS_REGION!,
        accessKeyId: environment.AWS_ACCESS_KEY_ID,
        secretAccessKey: environment.AWS_SECRET_ACCESS_KEY,
        sessionToken: environment.AWS_SESSION_TOKEN,
        endpoint: environment.S3_ENDPOINT,
        forcePathStyle: isR2Endpoint(environment.S3_ENDPOINT) ? true : environment.S3_FORCE_PATH_STYLE,
      }),
    );
    const prefix = appEnv ? `${appEnv}/organizations/` : 'organizations/';
    rawObjects = await listS3Objects(client, environment.S3_BUCKET!, prefix);
  } else {
    rawObjects = await listLocalObjects(
      environment.LOCAL_STORAGE_PATH ?? path.join(process.cwd(), 'public'),
      `/uploads/${appEnv}`,
    );
  }

  const objects = rawObjects.map((obj) => ({
    ...obj,
    key: normalizeStorageKey(obj.key, appEnv),
  }));

  const references = await collectDbStorageReferences(prisma);
  const rows = reconcileStorageAudit({ objects, references, appEnv });

  const orphans = rows.filter((r) => r.section === 'HUERFANOS').length;
  const missing = rows.filter((r) => r.section === 'FALTANTES').length;
  const overwrites = rows.filter((r) => r.section === 'POSIBLE_SOBRESCRITURA').length;

  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, formatStorageAuditCsv(rows), 'utf8');

  console.info('[storage:audit] Resumen');
  console.info(`  Objetos bajo organizations/**: ${objects.length}`);
  console.info(`  Referencias en BD: ${references.length}`);
  console.info(`  HUÉRFANOS: ${orphans}`);
  console.info(`  FALTANTES: ${missing}`);
  console.info(`  POSIBLE SOBRESCRITURA: ${overwrites}`);
  console.info(`  Reporte: ${reportPath}`);
}

main()
  .catch((error) => {
    console.error('[storage:audit] Error', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
