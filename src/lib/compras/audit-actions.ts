export const COMPRA_AUDIT = {
  SOLICITUD_CREADA: 'compra_solicitud_creada',
  DOCUMENTO_GENERADO: 'compra_documento_generado',
  DOCUMENTO_REGENERADO: 'compra_documento_regenerado',
  DOCUMENTO_DESCARGADO: 'compra_documento_descargado',
  DOCUMENTO_VISUALIZADO: 'compra_documento_visualizado',
  DOCUMENTO_ERROR: 'compra_documento_error_generacion',
} as const;

export type CompraAuditAction = (typeof COMPRA_AUDIT)[keyof typeof COMPRA_AUDIT];
