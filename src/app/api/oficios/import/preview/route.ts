import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { apiFailure, apiSuccess } from '@/platform/api/response';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { OFICIO_IMPORT_MAX_BYTES } from '@/modules/oficios/import-export/types';
import { previewOficioImportWorkbook } from '@/modules/oficios/import-export/oficios-import';
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
    if (!(file instanceof File)) {
      return apiFailure('FILE_REQUIRED', 'Seleccione un archivo XLSX.', { requestId, status: 400, details: [], stage: 'VALIDATE_UPLOAD' });
    }
    if (!file.name.toLowerCase().endsWith('.xlsx') || (file.type && file.type !== XLSX_MIME && file.type !== 'application/octet-stream')) {
      return apiFailure('INVALID_FILE_TYPE', 'Solo se permiten archivos .xlsx.', { requestId, status: 415, details: [], stage: 'VALIDATE_UPLOAD' });
    }
    if (file.size === 0 || file.size > OFICIO_IMPORT_MAX_BYTES) {
      return apiFailure('INVALID_FILE_SIZE', 'El archivo debe pesar como máximo 5 MB.', { requestId, status: 413, details: [], stage: 'VALIDATE_UPLOAD' });
    }

    const preview = await previewOficioImportWorkbook({
      buffer: Buffer.from(await file.arrayBuffer()),
      organizationId: organization.organizationId,
    });
    return apiSuccess(preview, { requestId });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    const code = error instanceof Error ? error.message : '';
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
    console.error('[OFICIOS IMPORT PREVIEW ERROR]', { requestId, error });
    return apiFailure('INVALID_WORKBOOK', XLSX_WORKBOOK_USER_MESSAGES.INVALID_WORKBOOK, { requestId, status: 400, details: [], stage: 'PARSE_WORKBOOK' });
  }
}

export const POST = withAuth(postHandler);
