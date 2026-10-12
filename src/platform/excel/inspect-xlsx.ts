import JSZip from 'jszip';

export const XLSX_WORKBOOK_ERROR_CODES = [
  'NOT_A_XLSX',
  'ENCRYPTED_OR_LEGACY_XLS',
  'XLSB_NOT_SUPPORTED',
  'XLSM_NOT_SUPPORTED',
  'STRICT_OOXML_NOT_SUPPORTED',
  'NONSTANDARD_WORKBOOK',
  'INVALID_WORKBOOK',
] as const;

export type XlsxWorkbookErrorCode = (typeof XLSX_WORKBOOK_ERROR_CODES)[number];

export const XLSX_WORKBOOK_USER_MESSAGES: Record<XlsxWorkbookErrorCode, string> = {
  NOT_A_XLSX:
    'El archivo no es un libro Excel (.xlsx) válido. Puede ser CSV, HTML u otro formato renombrado, o un ZIP dañado.',
  ENCRYPTED_OR_LEGACY_XLS:
    'El archivo parece ser Excel 97-2003 (.xls) o un libro protegido con contraseña. Ábralo en Excel y guárdelo como Libro de Excel (.xlsx) sin contraseña.',
  XLSB_NOT_SUPPORTED:
    'El archivo está en formato binario (.xlsb). Ábralo en Excel y use Guardar como → Libro de Excel (.xlsx).',
  XLSM_NOT_SUPPORTED:
    'El archivo contiene macros (.xlsm). Ábralo en Excel y use Guardar como → Libro de Excel (.xlsx) sin macros.',
  STRICT_OOXML_NOT_SUPPORTED:
    'El archivo está en formato Open XML estricto. Ábralo en Excel y use Guardar como → Libro de Excel (.xlsx).',
  NONSTANDARD_WORKBOOK:
    'El archivo ZIP no incluye la estructura estándar de Excel (xl/workbook.xml). Use la plantilla oficial o vuelva a guardar el libro en Excel como .xlsx.',
  INVALID_WORKBOOK:
    'Excel no pudo leer el contenido del archivo. Vuelva a guardarlo en Excel como .xlsx o descargue la plantilla oficial.',
};

export function isXlsxWorkbookErrorCode(code: string): code is XlsxWorkbookErrorCode {
  return (XLSX_WORKBOOK_ERROR_CODES as readonly string[]).includes(code);
}

function reject(code: XlsxWorkbookErrorCode): never {
  throw new Error(code);
}

function isZipSignature(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) return false;
  return buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07;
}

function isCompoundFileSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 4
    && buffer[0] === 0xd0
    && buffer[1] === 0xcf
    && buffer[2] === 0x11
    && buffer[3] === 0xe0
  );
}

const MACRO_CONTENT_TYPE = /spreadsheetml\.sheet\.macroEnabled|macroEnabled\.main\+xml/i;
const STRICT_OOXML = /purl\.oclc\.org\/ooxml/i;

/**
 * Validates that `buffer` is a standard (non-strict, non-macro, non-binary) XLSX package
 * before handing it to ExcelJS.
 */
export async function inspectXlsxBuffer(buffer: Buffer): Promise<void> {
  if (isCompoundFileSignature(buffer)) {
    reject('ENCRYPTED_OR_LEGACY_XLS');
  }

  if (!isZipSignature(buffer)) {
    reject('NOT_A_XLSX');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    reject('NOT_A_XLSX');
  }

  if (zip.file('xl/workbook.bin')) {
    reject('XLSB_NOT_SUPPORTED');
  }

  const contentTypesEntry = zip.file('[Content_Types].xml');
  const contentTypes = contentTypesEntry ? await contentTypesEntry.async('string') : '';

  if (contentTypes && MACRO_CONTENT_TYPE.test(contentTypes)) {
    reject('XLSM_NOT_SUPPORTED');
  }

  if (contentTypes && STRICT_OOXML.test(contentTypes)) {
    reject('STRICT_OOXML_NOT_SUPPORTED');
  }

  for (const path of Object.keys(zip.files)) {
    if (path !== '_rels/.rels' && !path.startsWith('xl/_rels/')) continue;
    const relsEntry = zip.file(path);
    if (!relsEntry) continue;
    const relsXml = await relsEntry.async('string');
    if (STRICT_OOXML.test(relsXml)) {
      reject('STRICT_OOXML_NOT_SUPPORTED');
    }
  }

  const workbookXmlEntry = zip.file('xl/workbook.xml');
  if (workbookXmlEntry) {
    const workbookXml = await workbookXmlEntry.async('string');
    if (STRICT_OOXML.test(workbookXml)) {
      reject('STRICT_OOXML_NOT_SUPPORTED');
    }
  } else if (zip.file('xl/vbaProject.bin')) {
    reject('XLSM_NOT_SUPPORTED');
  } else {
    reject('NONSTANDARD_WORKBOOK');
  }
}
