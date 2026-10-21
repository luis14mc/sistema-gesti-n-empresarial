import {
  applyNomenclaturePattern,
  numberingDependencyYearKey,
  parseOficioSequence,
  parseSequenceFromPattern,
  type OficioDependency,
} from '@/modules/oficios/domain/oficios-numbering';
import { oficioImportRowSchema } from './schemas';
import { defaultConfigSeed } from '@/modules/oficios/infrastructure/numbering';
import {
  createImportBatch,
  createImportBatchItem,
  createNumberingConfig,
  findActiveEmployeesByRefs,
  findLiveOficiosByNumbers,
  findOficioModifiedAfter,
  findUndoableBatch,
  finishImportBatch,
  loadNumberingConfigs,
  runImportChunk,
  runUndoImportTransaction,
  updateNumberingConfigSequence,
  type ImportNumberingConfig,
} from '@/modules/oficios/infrastructure/import-store';
import { parseOficioImportWorkbook } from './oficios-excel';
import type {
  OficioImportDuplicatePolicy,
  OficioImportNumberingSummary,
  OficioImportParsedRow,
  OficioImportPreviewResult,
  OficioImportRowPreview,
} from './types';
import { OFICIO_IMPORT_CHUNK_SIZE } from './types';
import { isLikelyRecordId } from '@/platform/import/organization-fk';

function yearFromOficio(row: Pick<OficioImportParsedRow, 'sequenceYear'>): number {
  return row.sequenceYear;
}

async function resolveResponsibleEmployees(
  organizationId: string,
  refs: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(refs.map((ref) => ref.trim().toLowerCase()).filter(Boolean))];
  if (unique.length === 0) return new Map();

  const idRefs = unique.filter(isLikelyRecordId);
  const lookupRefs = unique.filter((ref) => !isLikelyRecordId(ref));

  const employees = await findActiveEmployeesByRefs(organizationId, lookupRefs, idRefs);

  const map = new Map<string, string>();
  for (const employee of employees) {
    map.set(employee.id.toLowerCase(), employee.id);
    map.set(employee.email.trim().toLowerCase(), employee.id);
    if (employee.employeeCode) {
      map.set(employee.employeeCode.trim().toLowerCase(), employee.id);
    }
  }
  return map;
}

async function findExistingDuplicates(
  organizationId: string,
  rows: OficioImportParsedRow[],
): Promise<Map<number, { id: string; number: string }>> {
  const byKey = new Map<string, OficioImportParsedRow[]>();
  for (const row of rows) {
    const key = `${row.number.trim().toLowerCase()}|${row.type}|${yearFromOficio(row)}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  const numbers = [...new Set(rows.map((row) => row.number.trim()))];
  if (numbers.length === 0) return new Map();

  const existing = await findLiveOficiosByNumbers(organizationId, numbers);

  const duplicateByRow = new Map<number, { id: string; number: string }>();
  for (const row of rows) {
    const year = yearFromOficio(row);
    const match = existing.find((item) => {
      const itemYear = item.sequenceYear ?? item.oficioDate.getUTCFullYear();
      return item.number.trim().toLowerCase() === row.number.trim().toLowerCase()
        && item.type === row.type
        && itemYear === year;
    });
    if (match) duplicateByRow.set(row.row, { id: match.id, number: match.number });
  }
  return duplicateByRow;
}

function buildNumberingSummaries(
  rows: OficioImportParsedRow[],
  configs: ImportNumberingConfig[],
): OficioImportNumberingSummary[] {
  const grouped = new Map<string, { dependency: OficioDependency; year: number; sequences: number[]; warnings: string[] }>();

  for (const row of rows) {
    if (row.type === 'INCOMING') continue;
    const dependency = row.dependency as OficioDependency;
    const year = yearFromOficio(row);
    const key = numberingDependencyYearKey(dependency, year);
    const entry = grouped.get(key) ?? { dependency, year, sequences: [], warnings: [] };
    const config = configs.find((item) => item.dependency === dependency && item.year === year);
    const pattern = config?.nomenclaturePattern;
    if (pattern) {
      const fromPattern = parseSequenceFromPattern(row.number, pattern, year, config?.prefix);
      if (fromPattern != null) entry.sequences.push(fromPattern);
      else {
        const fallback = parseOficioSequence(row.number, year);
        if (fallback > 0) entry.sequences.push(fallback);
        entry.warnings.push(`Fila ${row.row}: el número «${row.number}» no encaja en el patrón ${pattern}.`);
      }
    } else {
      const fallback = parseOficioSequence(row.number, year);
      if (fallback > 0) entry.sequences.push(fallback);
    }
    grouped.set(key, entry);
  }

  return [...grouped.entries()].map(([key, value]) => {
    const config = configs.find((item) => item.dependency === value.dependency && item.year === value.year);
    const maxImportedSequence = value.sequences.length > 0 ? Math.max(...value.sequences) : 0;
    const floor = Math.max(config?.lastGeneratedSequence ?? 0, maxImportedSequence);
    const lastUsedSequence = Math.max(floor, maxImportedSequence);
    const pattern = config?.nomenclaturePattern ?? defaultConfigSeed(value.dependency, value.year).nomenclaturePattern;
    const prefix = config?.prefix;
    const sequencePadding = config?.sequencePadding ?? 0;
    const format = (sequence: number) =>
      applyNomenclaturePattern({
        pattern,
        sequence,
        year: value.year,
        prefix,
        sequencePadding,
      });

    return {
      key,
      dependency: value.dependency,
      year: value.year,
      maxImportedSequence,
      lastUsedSequence,
      lastImportedNumber: maxImportedSequence > 0 ? format(maxImportedSequence) : '—',
      nextOficioNumber: format(lastUsedSequence + 1),
      pattern: config?.nomenclaturePattern,
      patternWarnings: [...new Set(value.warnings)],
    };
  });
}

function validateParsedRowForCommit(row: OficioImportParsedRow): string | null {
  const parsed = oficioImportRowSchema.safeParse(row);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Fila inválida.';
  }
  if (!row.number.trim()) return 'Número de oficio obligatorio.';
  if (row.responsibleRef && !row.responsibleEmployeeId) {
    return 'Responsable no encontrado en esta organización.';
  }
  return null;
}

function savepointName(rowIndex: number): string {
  return `import_row_${rowIndex}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

export async function previewOficioImportWorkbook(input: {
  buffer: Buffer;
  organizationId: string;
}): Promise<OficioImportPreviewResult> {
  const parsed = await parseOficioImportWorkbook(input.buffer);
  const errorByRow = new Map<number, Array<{ field: string; message: string }>>();
  for (const error of parsed.errors) {
    const list = errorByRow.get(error.row) ?? [];
    list.push({ field: error.field, message: error.message });
    errorByRow.set(error.row, list);
  }

  const responsibleRefs = parsed.rows
    .map((row) => row.responsibleRef?.trim())
    .filter((value): value is string => Boolean(value));
  const employeeMap = await resolveResponsibleEmployees(input.organizationId, responsibleRefs);
  const duplicates = await findExistingDuplicates(input.organizationId, parsed.rows);
  const configs = await loadNumberingConfigs(input.organizationId);

  const validRows: OficioImportParsedRow[] = [];
  const previews: OficioImportRowPreview[] = [];

  for (const row of parsed.rows) {
    const rowErrors = errorByRow.get(row.row);
    if (rowErrors?.length) {
      previews.push({ row: row.row, status: 'error', errors: rowErrors });
      continue;
    }

    const warnings = [...row.warnings];
    let responsibleEmployeeId: string | undefined;
    if (row.responsibleRef) {
      responsibleEmployeeId = employeeMap.get(row.responsibleRef.trim().toLowerCase());
      if (!responsibleEmployeeId) {
        previews.push({
          row: row.row,
          status: 'error',
          errors: [{ field: 'Responsable', message: 'No se encontró empleado con ese correo, código o id en esta organización.' }],
        });
        continue;
      }
    }

    const duplicateOf = duplicates.get(row.row);
    if (duplicateOf) {
      previews.push({
        row: row.row,
        status: 'duplicate',
        number: row.number,
        duplicateOf,
        warnings,
        parsed: { ...row, responsibleEmployeeId },
      });
      continue;
    }

    validRows.push({ ...row, responsibleEmployeeId });
    previews.push({
      row: row.row,
      status: 'ok',
      number: row.number,
      warnings,
      parsed: { ...row, responsibleEmployeeId },
    });
  }

  for (const [row, errors] of errorByRow) {
    if (previews.some((preview) => preview.row === row)) continue;
    previews.push({ row, status: 'error', errors });
  }

  previews.sort((a, b) => a.row - b.row);

  return {
    totalRows: parsed.totalRows,
    validCount: previews.filter((row) => row.status === 'ok').length,
    errorCount: previews.filter((row) => row.status === 'error').length,
    duplicateCount: previews.filter((row) => row.status === 'duplicate').length,
    rows: previews,
    numbering: buildNumberingSummaries(validRows, configs),
  };
}

export async function commitOficioImportWorkbook(input: {
  buffer: Buffer;
  organizationId: string;
  userId: string;
  duplicates: OficioImportDuplicatePolicy;
  lastUsedSequenceOverrides: Record<string, number>;
  notes?: string;
}): Promise<{
  batchId: string;
  imported: number;
  skipped: number;
  errors: number;
  numberingApplied: OficioImportNumberingSummary[];
  configsCreated: string[];
}> {
  const preview = await previewOficioImportWorkbook({
    buffer: input.buffer,
    organizationId: input.organizationId,
  });

  if (preview.errorCount > 0) {
    throw new Error('IMPORT_HAS_ERRORS');
  }

  const rowsToImport = preview.rows.filter((row) => {
    if (row.status === 'ok') return true;
    if (row.status === 'duplicate' && input.duplicates === 'import') return true;
    return false;
  });

  if (rowsToImport.length === 0) {
    throw new Error('IMPORT_NOTHING_TO_COMMIT');
  }

  for (const summary of preview.numbering) {
    const override = input.lastUsedSequenceOverrides[summary.key];
    const confirmed = override ?? summary.lastUsedSequence;
    if (confirmed < summary.maxImportedSequence) {
      throw new Error(`SEQUENCE_TOO_LOW:${summary.key}`);
    }
  }

  const configs = await loadNumberingConfigs(input.organizationId);
  const sequenceSnapshot: Record<string, { lastGeneratedSequence: number; configId?: string }> = {};
  for (const summary of preview.numbering) {
    const config = configs.find((item) => item.dependency === summary.dependency && item.year === summary.year);
    sequenceSnapshot[summary.key] = {
      lastGeneratedSequence: config?.lastGeneratedSequence ?? 0,
      configId: config?.id,
    };
  }

  const configsCreated: string[] = [];
  const batch = await createImportBatch({
      organizationId: input.organizationId,
      source: 'HISTORICAL_IMPORT',
      status: 'PROCESSING',
      totalRows: preview.totalRows,
      totalFiles: 0,
      notes: input.notes,
      sequenceSnapshot,
      performedById: input.userId,
  });

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  if (input.duplicates === 'skip') {
    for (const previewRow of preview.rows) {
      if (previewRow.status !== 'duplicate') continue;
      skipped += 1;
      await createImportBatchItem({
          batchId: batch.id,
          rowIndex: previewRow.row,
          status: 'SKIPPED',
          number: previewRow.number ?? null,
          errorMessage: 'Duplicado omitido.',
      });
    }
  }

  const importableParsed: OficioImportParsedRow[] = [];
  for (const previewRow of rowsToImport) {
    if (!previewRow.parsed) continue;
    const candidate: OficioImportParsedRow = {
      row: previewRow.row,
      ...(previewRow.parsed as Omit<OficioImportParsedRow, 'row'>),
      warnings: previewRow.warnings ?? [],
    };
    const validationError = validateParsedRowForCommit(candidate);
    if (validationError) {
      errors += 1;
      await createImportBatchItem({
          batchId: batch.id,
          rowIndex: candidate.row,
          status: 'ERROR',
          number: candidate.number,
          institution: candidate.institution ?? null,
          oficioDate: candidate.oficioDate,
          errorMessage: validationError,
      });
      continue;
    }
    importableParsed.push(candidate);
  }

  for (let offset = 0; offset < importableParsed.length; offset += OFICIO_IMPORT_CHUNK_SIZE) {
    const chunk = importableParsed.slice(offset, offset + OFICIO_IMPORT_CHUNK_SIZE);
    await runImportChunk(async (store) => {
      for (const row of chunk) {
        const sp = savepointName(row.row);
        await store.savepoint(sp);
        try {
          if (row.responsibleEmployeeId) {
            const inOrg = await store.employeeBelongsToOrganization(
              row.responsibleEmployeeId,
              input.organizationId,
            );
            if (!inOrg) {
              throw new Error('EMPLOYEE_OUT_OF_ORGANIZATION');
            }
          }
          const oficio = await store.createOficio({
              organizationId: input.organizationId,
              number: row.number.trim(),
              type: row.type,
              scope: row.dependency,
              subject: row.subject,
              status: row.status,
              oficioDate: row.oficioDate,
              receivedDate: row.receivedDate ?? null,
              sentDate: row.sentDate ?? null,
              institution: row.institution ?? null,
              senderName: row.senderName ?? null,
              senderPosition: row.senderPosition ?? null,
              recipientName: row.recipientName ?? null,
              recipientPosition: row.recipientPosition ?? null,
              recipient: row.recipientName ?? null,
              preparedBy: row.preparedBy ?? null,
              cc: row.cc ?? null,
              comments: row.comments ?? null,
              sequenceYear: row.sequenceYear,
              responsibleEmployeeId: row.responsibleEmployeeId ?? null,
              recordSource: 'HISTORICAL_IMPORT',
              importedById: input.userId,
              importedAt: new Date(),
              createdById: input.userId,
              tracking: {
                create: {
                  action: 'IMPORTED',
                  title: 'Importado',
                  description: 'Oficio importado desde Excel histórico',
                  performedById: input.userId,
                },
              },
          });

          await store.createBatchItem({
              batchId: batch.id,
              rowIndex: row.row,
              status: 'IMPORTED',
              number: row.number,
              institution: row.institution ?? null,
              oficioDate: row.oficioDate,
              oficioId: oficio.id,
          });
          await store.releaseSavepoint(sp);
          imported += 1;
        } catch (error) {
          await store.rollbackToSavepoint(sp);
          errors += 1;
          const message = error instanceof Error && error.message === 'EMPLOYEE_OUT_OF_ORGANIZATION'
            ? 'El responsable no pertenece a esta organización.'
            : error instanceof Error
              ? error.message.slice(0, 500)
              : 'No se pudo crear el oficio.';
          await store.createBatchItem({
              batchId: batch.id,
              rowIndex: row.row,
              status: 'ERROR',
              number: row.number,
              institution: row.institution ?? null,
              oficioDate: row.oficioDate,
              errorMessage: message,
          });
        }
      }
    });
  }

  const numberingApplied: OficioImportNumberingSummary[] = [];
  for (const summary of preview.numbering) {
    const confirmed = input.lastUsedSequenceOverrides[summary.key] ?? summary.lastUsedSequence;
    let config = configs.find((item) => item.dependency === summary.dependency && item.year === summary.year);
    if (!config) {
      const seed = defaultConfigSeed(summary.dependency as OficioDependency, summary.year);
      config = await createNumberingConfig({
          organizationId: input.organizationId,
          dependency: seed.dependency,
          year: seed.year,
          nomenclaturePattern: seed.nomenclaturePattern,
          prefix: seed.prefix,
          sequencePadding: seed.sequencePadding,
          lastGeneratedSequence: confirmed,
          isActive: true,
          createdById: input.userId,
          notes: 'Creada automáticamente durante importación histórica.',
      });
      configsCreated.push(`${summary.dependency}-${summary.year}`);
    } else {
      await updateNumberingConfigSequence(config.id, confirmed, input.userId);
    }
    numberingApplied.push({
      ...summary,
      lastUsedSequence: confirmed,
      nextOficioNumber: summary.pattern
        ? applyNomenclaturePattern({
            pattern: summary.pattern,
            sequence: confirmed + 1,
            year: summary.year,
            prefix: config.prefix,
            sequencePadding: config.sequencePadding,
          })
        : summary.nextOficioNumber,
    });
  }

  await finishImportBatch(batch.id, {
      status: imported > 0 ? 'COMPLETED' : 'FAILED',
      imported,
      skipped,
      errors,
      finishedAt: new Date(),
  });

  return {
    batchId: batch.id,
    imported,
    skipped,
    errors,
    numberingApplied,
    configsCreated,
  };
}

export async function undoOficioImportBatch(input: {
  organizationId: string;
  batchId: string;
  userId: string;
}): Promise<{ archivedOficios: number }> {
  const batch = await findUndoableBatch(input.organizationId, input.batchId);
  if (!batch) throw new Error('BATCH_NOT_FOUND');
  if (!batch.finishedAt) throw new Error('BATCH_NOT_FINISHED');

  const oficioIds = batch.items.map((item) => item.oficioId!).filter(Boolean);
  if (oficioIds.length === 0) throw new Error('BATCH_EMPTY');

  const modified = await findOficioModifiedAfter(oficioIds, batch.finishedAt);
  if (modified) throw new Error('BATCH_MODIFIED');

  const snapshot = (batch.sequenceSnapshot ?? {}) as Record<string, { lastGeneratedSequence: number; configId?: string }>;

  await runUndoImportTransaction(async (store) => {
    await store.archiveOficios(oficioIds, input.organizationId, input.userId);

    for (const [key, value] of Object.entries(snapshot)) {
      if (value.configId) {
        await store.restoreConfigSequence(value.configId, value.lastGeneratedSequence, input.userId);
      } else {
        const lastDash = key.lastIndexOf('-');
        const dependency = key.slice(0, lastDash);
        const year = Number.parseInt(key.slice(lastDash + 1), 10);
        if (!dependency || Number.isNaN(year)) continue;
        await store.restoreConfigSequenceByKey(input.organizationId, dependency, year, value.lastGeneratedSequence, input.userId);
      }
    }

    await store.archiveBatch(batch.id);
  });

  return { archivedOficios: oficioIds.length };
}
