import ExcelJS from 'exceljs';
import { inspectXlsxBuffer } from './inspect-xlsx';

export async function loadXlsxWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  await inspectXlsxBuffer(buffer);
  const workbook = new ExcelJS.Workbook();
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  try {
    await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  } catch (cause) {
    const error = new Error('INVALID_WORKBOOK') as Error & { cause?: unknown };
    error.cause = cause;
    throw error;
  }
  return workbook;
}
