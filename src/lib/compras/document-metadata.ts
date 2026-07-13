import type { CompraDocumento } from '@prisma/client';

export type CompraDocumentoEstado = 'generado' | 'pendiente' | 'error';

export const TIPO_DOCUMENTO_API = 'solicitud_orden_compra_pdf' as const;

export function mapTipoDocumentoApi(
  tipo: CompraDocumento['tipoDocumento']
): typeof TIPO_DOCUMENTO_API {
  return tipo === 'ORDEN_COMPRA_PDF' ? TIPO_DOCUMENTO_API : TIPO_DOCUMENTO_API;
}

export function buildDocumentoUrls(solicitudId: string) {
  const base = `/api/compras/solicitudes/${solicitudId}/documento`;
  return {
    urlDescarga: `${base}/descargar`,
    urlVer: `${base}/descargar`,
  };
}

export function formatDocumentoMetadata(
  documento: Pick<
    CompraDocumento,
    'id' | 'nombreArchivo' | 'tipoDocumento' | 'version' | 'activo' | 'generadoEn' | 'mimeType'
  >,
  solicitudId: string
) {
  const urls = buildDocumentoUrls(solicitudId);
  return {
    id: documento.id,
    nombreArchivo: documento.nombreArchivo,
    tipoDocumento: mapTipoDocumentoApi(documento.tipoDocumento),
    version: documento.version,
    activo: documento.activo,
    mimeType: documento.mimeType,
    generadoEn: documento.generadoEn,
    ...urls,
  };
}

export function resolveDocumentoEstadoFromDocs(
  documentos: Array<Pick<CompraDocumento, 'activo'>> | undefined,
  hasGenerationError = false
): CompraDocumentoEstado {
  if (documentos?.some((doc) => doc.activo)) return 'generado';
  if (hasGenerationError) return 'error';
  return 'pendiente';
}
