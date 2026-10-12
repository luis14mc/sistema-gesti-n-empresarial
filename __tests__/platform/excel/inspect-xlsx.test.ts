import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { inspectXlsxBuffer } from '@/platform/excel/inspect-xlsx';
import { loadXlsxWorkbook } from '@/platform/excel/load-xlsx';
import { parseEquipmentWorkbook } from '@/modules/equipment/import-export/equipment-excel';
import { EQUIPMENT_IMPORT_HEADERS } from '@/modules/equipment/import-export/types';

async function zipBuffer(build: (zip: JSZip) => void): Promise<Buffer> {
  const zip = new JSZip();
  build(zip);
  return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}

async function expectWorkbookError(buffer: Buffer, code: string): Promise<void> {
  await expect(inspectXlsxBuffer(buffer)).rejects.toThrow(code);
  await expect(loadXlsxWorkbook(buffer)).rejects.toThrow(code);
  await expect(parseEquipmentWorkbook(buffer)).rejects.toThrow(code);
}

async function validTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Inventario');
  sheet.addRow([...EQUIPMENT_IMPORT_HEADERS]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('inspectXlsxBuffer', () => {
  it('accepts a standard XLSX produced by ExcelJS', async () => {
    const buffer = await validTemplateBuffer();
    await expect(inspectXlsxBuffer(buffer)).resolves.toBeUndefined();
    const workbook = await loadXlsxWorkbook(buffer);
    expect(workbook.getWorksheet('Inventario')).toBeTruthy();
    const parsed = await parseEquipmentWorkbook(buffer);
    expect(parsed.totalRows).toBe(0);
  });

  it('rejects a ZIP package without xl/workbook.xml', async () => {
    const buffer = await zipBuffer((zip) => {
      zip.file(
        '[Content_Types].xml',
        '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
      );
    });
    await expectWorkbookError(buffer, 'NONSTANDARD_WORKBOOK');
  });

  it('rejects compound-file (.xls / encrypted) signatures', async () => {
    const buffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00, 0x00, 0x00]);
    await expectWorkbookError(buffer, 'ENCRYPTED_OR_LEGACY_XLS');
  });

  it('rejects plain text renamed as .xlsx', async () => {
    await expectWorkbookError(Buffer.from('inventoryCode,type\nTI-1,LAPTOP\n'), 'NOT_A_XLSX');
  });

  it('rejects Strict OOXML workbooks', async () => {
    const buffer = await zipBuffer((zip) => {
      zip.file(
        '[Content_Types].xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
</Types>`,
      );
      zip.file(
        'xl/workbook.xml',
        '<?xml version="1.0"?><workbook xmlns="http://purl.oclc.org/ooxml/spreadsheetml/main"></workbook>',
      );
    });
    await expectWorkbookError(buffer, 'STRICT_OOXML_NOT_SUPPORTED');
  });

  it('rejects XLSB packages', async () => {
    const buffer = await zipBuffer((zip) => {
      zip.file('xl/workbook.bin', 'fake-binary-workbook');
    });
    await expectWorkbookError(buffer, 'XLSB_NOT_SUPPORTED');
  });

  it('rejects macro-enabled workbooks', async () => {
    const buffer = await zipBuffer((zip) => {
      zip.file(
        '[Content_Types].xml',
        `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/>
</Types>`,
      );
      zip.file(
        'xl/workbook.xml',
        '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"></workbook>',
      );
    });
    await expectWorkbookError(buffer, 'XLSM_NOT_SUPPORTED');
  });
});
