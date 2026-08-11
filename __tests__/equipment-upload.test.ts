import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  EQUIPMENT_DOCUMENT_TYPES,
  equipmentDocumentStoragePrefix,
  resolveEquipmentDocumentType,
} from '../src/lib/equipment-document-types';
import { saveEquipmentDocument } from '../src/lib/equipment-storage';
import { LocalStorageAdapter } from '../src/lib/storage/local';
import { resetStorageForTests, setStorageForTests } from '../src/lib/storage';

function makePdfFile(name = 'acta.pdf', content = 'pdf-content') {
  return new File([content], name, { type: 'application/pdf' });
}

describe('equipment document upload types', () => {
  it('expone los seis tipos institucionales', () => {
    expect(EQUIPMENT_DOCUMENT_TYPES).toEqual([
      'ACTA_ASIGNACION',
      'ACTA_DEVOLUCION',
      'FACTURA',
      'GARANTIA',
      'INFORME_MANTENIMIENTO',
      'ACTA_BAJA',
    ]);
  });

  it('resuelve tipoDocumento explícito', () => {
    expect(resolveEquipmentDocumentType({ tipoDocumento: 'FACTURA' })).toBe('FACTURA');
    expect(resolveEquipmentDocumentType({ tipoDocumento: 'ACTA_BAJA' })).toBe('ACTA_BAJA');
  });

  it('mapea subcarpetas legacy', () => {
    expect(resolveEquipmentDocumentType({ subfolder: 'assignments' })).toBe('ACTA_ASIGNACION');
    expect(resolveEquipmentDocumentType({ subfolder: 'returns' })).toBe('ACTA_DEVOLUCION');
    expect(resolveEquipmentDocumentType({ subfolder: 'maintenance' })).toBe('INFORME_MANTENIMIENTO');
  });

  it('rechaza tipo desconocido', () => {
    expect(() => resolveEquipmentDocumentType({ tipoDocumento: 'OTRO' })).toThrow(
      /Tipo de documento inválido/
    );
  });

  it('requiere tipoDocumento o subfolder legacy', () => {
    expect(() => resolveEquipmentDocumentType({})).toThrow(/tipoDocumento/);
  });

  it('genera prefijos de storage por tipo', () => {
    expect(equipmentDocumentStoragePrefix('GARANTIA')).toBe('equipment/garantias');
    expect(equipmentDocumentStoragePrefix('INFORME_MANTENIMIENTO')).toBe(
      'equipment/informes-mantenimiento'
    );
  });
});

describe('saveEquipmentDocument', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'sge-equipment-upload-'));
    resetStorageForTests();
    setStorageForTests(
      new LocalStorageAdapter({
        baseDir: tmpDir,
        publicPrefix: '/uploads',
      })
    );
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    resetStorageForTests();
  });

  it('guarda documento con StorageAdapter y retorna metadata tipada', async () => {
    const file = makePdfFile('factura-equipo.pdf');
    const document = await saveEquipmentDocument(file, { organizationId: 'org-test', tipoDocumento: 'FACTURA' });

    expect(document.tipoDocumento).toBe('FACTURA');
    expect(document.url).toMatch(/^\/uploads\/organizations\/org-test\/equipment\/facturas\/\d{4}\/\d{2}\//);
    expect(document.mimeType).toBe('application/pdf');
    expect(document.originalName).toBe('factura-equipo.pdf');
  });

  it('acepta acta de asignación firmada', async () => {
    const document = await saveEquipmentDocument(makePdfFile(), {
      organizationId: 'org-test',
      tipoDocumento: 'ACTA_ASIGNACION',
    });
    expect(document.url).toContain('/equipment/actas-asignacion/');
  });

  it('acepta acta de devolución firmada', async () => {
    const document = await saveEquipmentDocument(makePdfFile(), {
      organizationId: 'org-test',
      tipoDocumento: 'ACTA_DEVOLUCION',
    });
    expect(document.url).toContain('/equipment/actas-devolucion/');
  });
});
