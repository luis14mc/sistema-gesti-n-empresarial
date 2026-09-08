import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { createAuditRecord } from '@/lib/audit';
import { requireOrganizationContext, isOrganizationContextError } from '@/modules/organizations/application/context';
import { canForOrganization } from '@/platform/security/authorization/effective-permissions';
import { apiFailure, apiSuccess } from '@/platform/api/response';
import { EQUIPMENT_IMPORT_MAX_BYTES } from '@/modules/equipment/import-export/equipment-excel';
import { importEquipmentWorkbook } from '@/modules/equipment/import-export/equipment-import';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await requireOrganizationContext(req, requestId);
    if (!await canForOrganization(organization.userId, organization.organizationId, organization.role, 'equipment.create')) {
      return apiFailure('PERMISSION_DENIED', 'No tiene permiso para importar equipos.', { requestId, status: 403, details: [], stage: 'AUTHORIZE_EQUIPMENT_IMPORT' });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return apiFailure('FILE_REQUIRED', 'Seleccione un archivo XLSX.', { requestId, status: 400, details: [], stage: 'VALIDATE_UPLOAD' });
    if (!file.name.toLowerCase().endsWith('.xlsx') || (file.type && file.type !== XLSX_MIME && file.type !== 'application/octet-stream')) {
      return apiFailure('INVALID_FILE_TYPE', 'Solo se permiten archivos .xlsx.', { requestId, status: 415, details: [], stage: 'VALIDATE_UPLOAD' });
    }
    if (file.size === 0 || file.size > EQUIPMENT_IMPORT_MAX_BYTES) {
      return apiFailure('INVALID_FILE_SIZE', 'El archivo debe pesar como máximo 5 MB.', { requestId, status: 413, details: [], stage: 'VALIDATE_UPLOAD' });
    }
    const result = await importEquipmentWorkbook({
      buffer: Buffer.from(await file.arrayBuffer()),
      organizationId: organization.organizationId,
      userId: organization.userId,
      requestId,
    });
    await createAuditRecord({
      title: 'Importación masiva de equipos',
      description: `Importación Excel: ${result.imported} equipos creados y ${result.skipped} omitidos.`,
      module: 'EQUIPOS', category: 'CREATE', action: 'EQUIPMENT_BULK_IMPORT',
      userId: organization.userId, organizationId: organization.organizationId, requestId,
      metadata: { totalRows: result.totalRows, imported: result.imported, skipped: result.skipped, errorCount: result.errors.length },
    });
    return apiSuccess(result, { requestId });
  } catch (error) {
    if (isOrganizationContextError(error)) return apiFailure(error.code, 'No fue posible resolver el contexto de organización.', { requestId, status: error.status, details: [], stage: 'RESOLVE_ORGANIZATION_CONTEXT' });
    const code = error instanceof Error ? error.message : '';
    const known: Record<string, string> = {
      MISSING_INVENTORY_WORKSHEET: 'No existe la hoja Inventario.', INVALID_HEADERS: 'Los encabezados no corresponden a la plantilla oficial.',
      ROW_LIMIT_EXCEEDED: 'El archivo supera el máximo de 1000 filas.',
    };
    if (known[code]) return apiFailure(code, known[code], { requestId, status: 400, details: [], stage: 'PARSE_WORKBOOK' });
    console.error('[EQUIPMENT IMPORT ERROR]', { requestId, error });
    return apiFailure('INVALID_WORKBOOK', 'No se pudo procesar el archivo XLSX.', { requestId, status: 400, details: [], stage: 'PARSE_WORKBOOK' });
  }
}

export const POST = withAuth(postHandler);
