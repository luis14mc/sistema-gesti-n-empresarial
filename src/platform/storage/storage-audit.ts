import type { PrismaClient } from '@prisma/client';
import { equipmentDocumentKeyFromUrl } from '@/modules/equipment/infrastructure/equipment-document-access';

export type DbStorageReference = {
  entity: string;
  id: string;
  storageKey: string;
  createdAt: string;
};

export type ListedStorageObject = {
  key: string;
  size: number;
  lastModified: string;
  originalName?: string;
};

export type StorageAuditRow = {
  section: 'HUERFANOS' | 'FALTANTES' | 'POSIBLE_SOBRESCRITURA';
  storageKey: string;
  size?: number;
  lastModified?: string;
  originalName?: string;
  entity?: string;
  id?: string;
  createdAt?: string;
  detail?: string;
};

export function normalizeStorageKey(key: string, appEnv?: string): string {
  let normalized = key.trim().replace(/^\/+/, '');
  normalized = normalized.replace(/^uploads\/[^/]+\//, '');
  if (appEnv && normalized.startsWith(`${appEnv}/`)) {
    normalized = normalized.slice(appEnv.length + 1);
  }
  return normalized;
}

function pushRef(
  refs: DbStorageReference[],
  entity: string,
  id: string,
  storageKey: string | null | undefined,
  createdAt: Date | string,
) {
  if (!storageKey?.trim()) return;
  refs.push({
    entity,
    id,
    storageKey: storageKey.trim(),
    createdAt: typeof createdAt === 'string' ? createdAt : createdAt.toISOString(),
  });
}

function pushUrlRef(
  refs: DbStorageReference[],
  entity: string,
  id: string,
  url: string | null | undefined,
  createdAt: Date | string,
) {
  if (!url?.trim()) return;
  const key = equipmentDocumentKeyFromUrl(url) ?? url.trim();
  pushRef(refs, entity, id, key, createdAt);
}

export async function collectDbStorageReferences(prisma: PrismaClient): Promise<DbStorageReference[]> {
  const refs: DbStorageReference[] = [];

  const [
    oficioDocuments,
    disposalDocuments,
    disposalPdfs,
    purchaseDocuments,
    payslips,
    organizations,
    reportExecutions,
    assignments,
    maintenances,
  ] = await Promise.all([
    prisma.oficioDocument.findMany({
      select: { id: true, storageKey: true, uploadedAt: true },
    }),
    prisma.disposalDocument.findMany({
      select: { id: true, storageKey: true, createdAt: true },
    }),
    prisma.equipmentDisposal.findMany({
      where: { pdfStorageKey: { not: null } },
      select: { id: true, pdfStorageKey: true, createdAt: true },
    }),
    prisma.compraOrdenDocumento.findMany({
      select: { id: true, storageKey: true, uploadedAt: true },
    }),
    prisma.payslip.findMany({
      where: { pdfStorageKey: { not: null } },
      select: { id: true, pdfStorageKey: true, generatedAt: true },
    }),
    prisma.organization.findMany({
      where: { logoKey: { not: null } },
      select: { id: true, logoKey: true, createdAt: true },
    }),
    prisma.reportExecution.findMany({
      where: { storageKey: { not: null } },
      select: { id: true, storageKey: true, createdAt: true },
    }),
    prisma.equipmentAssignment.findMany({
      select: {
        id: true,
        createdAt: true,
        deliveryDocumentUrl: true,
        returnDocumentUrl: true,
        urlNotaPdf: true,
      },
    }),
    prisma.equipmentMaintenance.findMany({
      where: { documentUrl: { not: null } },
      select: { id: true, documentUrl: true, createdAt: true },
    }),
  ]);

  for (const doc of oficioDocuments) {
    pushRef(refs, 'OficioDocument', doc.id, doc.storageKey, doc.uploadedAt);
  }

  for (const doc of disposalDocuments) {
    pushRef(refs, 'DisposalDocument', doc.id, doc.storageKey, doc.createdAt);
  }

  for (const disposal of disposalPdfs) {
    pushRef(refs, 'EquipmentDisposal.pdf', disposal.id, disposal.pdfStorageKey, disposal.createdAt);
  }

  for (const doc of purchaseDocuments) {
    pushRef(refs, 'CompraOrdenDocumento', doc.id, doc.storageKey, doc.uploadedAt);
  }

  for (const payslip of payslips) {
    pushRef(refs, 'Payslip', payslip.id, payslip.pdfStorageKey, payslip.generatedAt);
  }

  for (const org of organizations) {
    pushRef(refs, 'Organization.logo', org.id, org.logoKey, org.createdAt);
  }

  for (const report of reportExecutions) {
    pushRef(refs, 'ReportExecution', report.id, report.storageKey, report.createdAt);
  }

  for (const assignment of assignments) {
    pushUrlRef(refs, 'EquipmentAssignment.delivery', assignment.id, assignment.deliveryDocumentUrl, assignment.createdAt);
    pushUrlRef(refs, 'EquipmentAssignment.return', assignment.id, assignment.returnDocumentUrl, assignment.createdAt);
    pushUrlRef(refs, 'EquipmentAssignment.nota', assignment.id, assignment.urlNotaPdf, assignment.createdAt);
  }

  for (const maintenance of maintenances) {
    pushUrlRef(refs, 'EquipmentMaintenance', maintenance.id, maintenance.documentUrl, maintenance.createdAt);
  }

  return refs;
}

export function reconcileStorageAudit(params: {
  objects: ListedStorageObject[];
  references: DbStorageReference[];
  appEnv?: string;
}): StorageAuditRow[] {
  const { objects, references, appEnv } = params;
  const objectByKey = new Map<string, ListedStorageObject>();
  for (const obj of objects) {
    objectByKey.set(normalizeStorageKey(obj.key, appEnv), obj);
  }

  const refsByKey = new Map<string, DbStorageReference[]>();
  for (const ref of references) {
    const normalized = normalizeStorageKey(ref.storageKey, appEnv);
    const list = refsByKey.get(normalized) ?? [];
    list.push({ ...ref, storageKey: normalized });
    refsByKey.set(normalized, list);
  }

  const rows: StorageAuditRow[] = [];

  for (const [key, obj] of objectByKey) {
    if (!key.includes('organizations/')) continue;
    const refs = refsByKey.get(key);
    if (!refs?.length) {
      rows.push({
        section: 'HUERFANOS',
        storageKey: key,
        size: obj.size,
        lastModified: obj.lastModified,
        originalName: obj.originalName,
      });
    }
  }

  for (const [key, refs] of refsByKey) {
    if (!objectByKey.has(key)) {
      for (const ref of refs) {
        rows.push({
          section: 'FALTANTES',
          storageKey: key,
          entity: ref.entity,
          id: ref.id,
          createdAt: ref.createdAt,
        });
      }
    } else if (refs.length > 1) {
      const distinctIds = new Set(refs.map((r) => `${r.entity}:${r.id}`));
      if (distinctIds.size > 1) {
        rows.push({
          section: 'POSIBLE_SOBRESCRITURA',
          storageKey: key,
          detail: refs
            .map((r) => `${r.entity} ${r.id} @ ${r.createdAt}`)
            .join(' | '),
        });
      }
    }
  }

  return rows;
}

const CSV_SECTION_ORDER: StorageAuditRow['section'][] = [
  'HUERFANOS',
  'FALTANTES',
  'POSIBLE_SOBRESCRITURA',
];

const CSV_SECTION_LABEL: Record<StorageAuditRow['section'], string> = {
  HUERFANOS: 'HUÉRFANOS',
  FALTANTES: 'FALTANTES',
  POSIBLE_SOBRESCRITURA: 'POSIBLE SOBRESCRITURA',
};

export function formatStorageAuditCsv(rows: StorageAuditRow[]): string {
  const header =
    'section,storageKey,size,lastModified,originalName,entity,id,createdAt,detail';
  const formatRow = (row: StorageAuditRow) =>
    [
      row.section,
      row.storageKey,
      row.size ?? '',
      row.lastModified ?? '',
      row.originalName ?? '',
      row.entity ?? '',
      row.id ?? '',
      row.createdAt ?? '',
      row.detail ?? '',
    ]
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',');

  const blocks: string[] = [];
  for (const section of CSV_SECTION_ORDER) {
    const sectionRows = rows.filter((row) => row.section === section);
    blocks.push(`# ${CSV_SECTION_LABEL[section]} (${sectionRows.length})`);
    blocks.push(header);
    blocks.push(...sectionRows.map(formatRow));
    blocks.push('');
  }
  return blocks.join('\n').trimEnd();
}

export function parseOrphanKeysFromAuditCsv(csv: string): Array<{
  storageKey: string;
  lastModified?: string;
}> {
  const lines = csv.split('\n').filter(Boolean);
  if (lines.length <= 1) return [];
  const orphans: Array<{ storageKey: string; lastModified?: string }> = [];
  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('section,')) continue;
    const cols = line.match(/("([^"]|"")*"|[^,]*)/g)?.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"')) ?? [];
    if (cols[0] !== 'HUERFANOS') continue;
    orphans.push({ storageKey: cols[1], lastModified: cols[3] || undefined });
  }
  return orphans;
}
