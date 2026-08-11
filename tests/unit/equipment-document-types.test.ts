// Phase 10B — domain unit tests for the equipment document type resolver.
import { describe, expect, it } from 'vitest';
import {
  EQUIPMENT_DOCUMENT_TYPES,
  equipmentDocumentStoragePrefix,
  isEquipmentDocumentType,
  resolveEquipmentDocumentType,
} from '@/lib/equipment-document-types';

describe('EQUIPMENT_DOCUMENT_TYPES catalogue', () => {
  it('exposes the documented document types', () => {
    expect(EQUIPMENT_DOCUMENT_TYPES).toEqual([
      'ACTA_ASIGNACION',
      'ACTA_DEVOLUCION',
      'FACTURA',
      'GARANTIA',
      'INFORME_MANTENIMIENTO',
      'ACTA_BAJA',
    ]);
  });

  it('does not expose executable or script extensions', () => {
    for (const forbidden of ['EXE', 'BAT', 'CMD', 'SH', 'PS1', 'JS', 'JAR']) {
      expect(EQUIPMENT_DOCUMENT_TYPES).not.toContain(forbidden);
    }
  });
});

describe('isEquipmentDocumentType', () => {
  it('accepts every documented type', () => {
    for (const type of EQUIPMENT_DOCUMENT_TYPES) {
      expect(isEquipmentDocumentType(type)).toBe(true);
    }
  });

  it('rejects unknown types', () => {
    expect(isEquipmentDocumentType('UNKNOWN')).toBe(false);
    expect(isEquipmentDocumentType('')).toBe(false);
  });
});

describe('resolveEquipmentDocumentType', () => {
  it('accepts an explicit canonical type', () => {
    expect(resolveEquipmentDocumentType({ tipoDocumento: 'FACTURA' })).toBe('FACTURA');
  });

  it('rejects an unknown canonical type', () => {
    expect(() => resolveEquipmentDocumentType({ tipoDocumento: 'NOT_A_TYPE' }))
      .toThrow(/tipo de documento inválido/i);
  });

  it('maps the legacy assignments subfolder to ACTA_ASIGNACION', () => {
    expect(resolveEquipmentDocumentType({ subfolder: 'assignments' })).toBe('ACTA_ASIGNACION');
  });

  it('maps the legacy returns subfolder to ACTA_DEVOLUCION', () => {
    expect(resolveEquipmentDocumentType({ subfolder: 'returns' })).toBe('ACTA_DEVOLUCION');
  });

  it('maps the legacy maintenance subfolder to INFORME_MANTENIMIENTO', () => {
    expect(resolveEquipmentDocumentType({ subfolder: 'maintenance' })).toBe('INFORME_MANTENIMIENTO');
  });

  it('throws when neither tipoDocumento nor subfolder is provided', () => {
    expect(() => resolveEquipmentDocumentType({})).toThrow(/tipoDocumento/);
  });
});

describe('equipmentDocumentStoragePrefix', () => {
  it('returns the documented storage prefix for each type', () => {
    expect(equipmentDocumentStoragePrefix('ACTA_ASIGNACION')).toBe('equipment/actas-asignacion');
    expect(equipmentDocumentStoragePrefix('ACTA_DEVOLUCION')).toBe('equipment/actas-devolucion');
    expect(equipmentDocumentStoragePrefix('FACTURA')).toBe('equipment/facturas');
    expect(equipmentDocumentStoragePrefix('GARANTIA')).toBe('equipment/garantias');
    expect(equipmentDocumentStoragePrefix('INFORME_MANTENIMIENTO')).toBe('equipment/informes-mantenimiento');
    expect(equipmentDocumentStoragePrefix('ACTA_BAJA')).toBe('equipment/actas-baja');
  });
});
