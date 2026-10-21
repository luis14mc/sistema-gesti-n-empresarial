import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import { apiFailure, apiSuccess } from '@/platform/api/response';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { oficioImportCommitSchema } from '@/modules/oficios/import-export/schemas';
import { commitOficioImportWorkbook } from '@/modules/oficios/import-export/oficios-import';
import { OFICIO_IMPORT_MAX_BYTES } from '@/modules/oficios/import-export/types';
import {
  isXlsxWorkbookErrorCode,
  XLSX_WORKBOOK_USER_MESSAGES,
} from '@/platform/excel/inspect-xlsx';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'oficios.import');
    const form = await req.formData();
    const file = form.get('file');
    const payloadRaw = form.get('payload');
    if (!(file instanceof File)) {
      return apiFailure('FILE_REQUIRED', 'Seleccione un archivo XLSX.', { requestId, status: 400, details: [], stage: 'VALIDATE_UPLOAD' });
    }
    if (typeof payloadRaw !== 'string') {
      return apiFailure('PAYLOAD_REQUIRED', 'Falta la configuración de importación.', { requestId, status: 400, details: [], stage: 'VALIDATE_UPLOAD' });
    }
    let payloadJson: unknown;
    try {
      payloadJson = JSON.parse(payloadRaw);
    } catch {
      return apiFailure('INVALID_PAYLOAD', 'Payload JSON inválido.', { requestId, status: 400, details: [], stage: 'VALIDATE_UPLOAD' });
    }
    const payload = oficioImportCommitSchema.safeParse(payloadJson);
    if (!payload.success) {
      return apiFailure('INVALID_PAYLOAD', 'Configuración de importación inválida.', { requestId, status: 400, details: payload.error.issues, stage: 'VALIDATE_UPLOAD' });
    }
    if (!file.name.toLowerCase().endsWith('.xlsx') || (file.type && file.type !== XLSX_MIME && file.type !== 'application/octet-stream')) {
      return apiFailure('INVALID_FILE_TYPE', 'Solo se permiten archivos .xlsx.', { requestId, status: 415, details: [], stage: 'VALIDATE_UPLOAD' });
    }
    if (file.size === 0 || file.size > OFICIO_IMPORT_MAX_BYTES) {
      return apiFailure('INVALID_FILE_SIZE', 'El archivo debe pesar como máximo 5 MB.', { requestId, status: 413, details: [], stage: 'VALIDATE_UPLOAD' });
    }

    const lastUsedSequenceOverrides = {
      ...payload.data.nextSequenceOverrides,
      ...payload.data.lastUsedSequenceOverrides,
    };

    const result = await commitOficioImportWorkbook({
      buffer: Buffer.from(await file.arrayBuffer()),
      organizationId: organization.organizationId,
      userId: organization.userId,
      duplicates: payload.data.duplicates,
      lastUsedSequenceOverrides,
      notes: typeof form.get('notes') === 'string' ? String(form.get('notes')) : undefined,
    });

    await createAuditRecord({
      title: 'Importación histórica de correspondencia (Excel)',
      description: `Lote ${result.batchId}: ${result.imported} importados, ${result.skipped} omitidos, ${result.errors} errores.`,
      module: 'OFICIOS',
      category: 'CREATE',
      action: 'OFICIO_EXCEL_IMPORT',
      userId: organization.userId,
      organizationId: organization.organizationId,
      requestId,
      metadata: result,
    });

    return apiSuccess(result, { requestId });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    const code = error instanceof Error ? error.message : '';
    if (code === 'IMPORT_HAS_ERRORS') {
      return apiFailure(code, 'Corrija los errores de la vista previa antes de confirmar.', { requestId, status: 400, details: [], stage: 'COMMIT' });
    }
    if (code === 'IMPORT_NOTHING_TO_COMMIT') {
      return apiFailure(code, 'No hay filas válidas para importar.', { requestId, status: 400, details: [], stage: 'COMMIT' });
    }
    if (code.startsWith('SEQUENCE_TOO_LOW:')) {
      return apiFailure('SEQUENCE_TOO_LOW', 'El correlativo confirmado es menor al máximo importado.', { requestId, status: 400, details: [{ key: code.split(':')[1] }], stage: 'COMMIT' });
    }
    const known: Record<string, string> = {
      MISSING_CORRESPONDENCE_WORKSHEET: 'No existe la hoja Correspondencia.',
      INVALID_HEADERS: 'Los encabezados no corresponden a la plantilla oficial.',
      ROW_LIMIT_EXCEEDED: 'El archivo supera el máximo de 2000 filas.',
      ...XLSX_WORKBOOK_USER_MESSAGES,
    };
    if (known[code]) {
      return apiFailure(code, known[code], { requestId, status: 400, details: [], stage: 'PARSE_WORKBOOK' });
    }
    if (isXlsxWorkbookErrorCode(code)) {
      return apiFailure(code, XLSX_WORKBOOK_USER_MESSAGES[code], { requestId, status: 400, details: [], stage: 'PARSE_WORKBOOK' });
    }
    console.error('[OFICIOS IMPORT COMMIT ERROR]', { requestId, error });
    return apiFailure('IMPORT_COMMIT_FAILED', 'No se pudo completar la importación.', { requestId, status: 500, details: [], stage: 'COMMIT' });
  }
}

export const POST = withAuth(postHandler);
