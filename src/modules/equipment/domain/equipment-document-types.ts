export const EQUIPMENT_DOCUMENT_TYPES = [
  'ACTA_ASIGNACION',
  'ACTA_DEVOLUCION',
  'FACTURA',
  'GARANTIA',
  'INFORME_MANTENIMIENTO',
  'ACTA_BAJA',
] as const;

export type EquipmentDocumentType = (typeof EQUIPMENT_DOCUMENT_TYPES)[number];

export const EQUIPMENT_DOCUMENT_TYPE_LABELS: Record<EquipmentDocumentType, string> = {
  ACTA_ASIGNACION: 'Acta de asignación firmada',
  ACTA_DEVOLUCION: 'Acta de devolución firmada',
  FACTURA: 'Factura',
  GARANTIA: 'Garantía',
  INFORME_MANTENIMIENTO: 'Informe de mantenimiento',
  ACTA_BAJA: 'Acta de baja',
};

const EQUIPMENT_DOCUMENT_STORAGE_FOLDERS: Record<EquipmentDocumentType, string> = {
  ACTA_ASIGNACION: 'actas-asignacion',
  ACTA_DEVOLUCION: 'actas-devolucion',
  FACTURA: 'facturas',
  GARANTIA: 'garantias',
  INFORME_MANTENIMIENTO: 'informes-mantenimiento',
  ACTA_BAJA: 'actas-baja',
};

/** Subcarpetas legacy del endpoint anterior → tipo documento institucional */
const LEGACY_SUBFOLDER_MAP: Record<string, EquipmentDocumentType> = {
  assignments: 'ACTA_ASIGNACION',
  returns: 'ACTA_DEVOLUCION',
  maintenance: 'INFORME_MANTENIMIENTO',
  general: 'ACTA_ASIGNACION',
  invoices: 'FACTURA',
  warranty: 'GARANTIA',
  decommission: 'ACTA_BAJA',
};

export function isEquipmentDocumentType(value: string): value is EquipmentDocumentType {
  return (EQUIPMENT_DOCUMENT_TYPES as readonly string[]).includes(value);
}

export function resolveEquipmentDocumentType(input: {
  tipoDocumento?: string | null;
  subfolder?: string | null;
}): EquipmentDocumentType {
  const raw = (input.tipoDocumento ?? '').trim();
  if (raw) {
    if (!isEquipmentDocumentType(raw)) {
      throw new Error(
        `Tipo de documento inválido. Valores permitidos: ${EQUIPMENT_DOCUMENT_TYPES.join(', ')}`
      );
    }
    return raw;
  }

  const legacy = (input.subfolder ?? '').trim();
  if (legacy && LEGACY_SUBFOLDER_MAP[legacy]) {
    return LEGACY_SUBFOLDER_MAP[legacy];
  }

  throw new Error(
    'Debes indicar tipoDocumento (ACTA_ASIGNACION, ACTA_DEVOLUCION, FACTURA, GARANTIA, INFORME_MANTENIMIENTO, ACTA_BAJA)'
  );
}

export function equipmentDocumentStoragePrefix(tipo: EquipmentDocumentType): string {
  return `equipment/${EQUIPMENT_DOCUMENT_STORAGE_FOLDERS[tipo]}`;
}
