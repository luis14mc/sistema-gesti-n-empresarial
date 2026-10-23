import ExcelJS from 'exceljs';
import { loadXlsxWorkbook } from '@/platform/excel/load-xlsx';
import { toXlsx } from '@/platform/reporting/export/xlsx';
import type { LicenseImportRow } from '@/modules/software-licenses/domain/import-rows';
import { formatPaymentSchedule } from '@/modules/software-licenses/domain/billing';

const HEADERS = ['Software', 'Usuario', 'Correo', 'Tipo', 'Equipo', 'Estado', 'Fecha de Pago'] as const;

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') return value.text;
  if (typeof value === 'object' && 'result' in value) return cellText(value.result as ExcelJS.CellValue);
  return String(value).trim();
}

export async function readLicenseWorkbook(buffer: Buffer): Promise<LicenseImportRow[]> {
  const workbook = await loadXlsxWorkbook(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const headerRow = sheet.getRow(1);
  const index = new Map<string, number>();
  headerRow.eachCell((cell, column) => {
    index.set(cellText(cell.value).toLowerCase(), column);
  });
  const column = (name: string) => index.get(name.toLowerCase());
  const software = column('Software');
  const usuario = column('Usuario');
  const correo = column('Correo');
  const compartida = column('¿Compartida?') ?? column('Compartida');
  const tipo = column('Tipo');
  const equipo = column('Equipo');
  const estado = column('Estado');
  const fecha = column('Fecha de Pago');
  if (!software) throw new Error('MISSING_SOFTWARE_COLUMN');
  const rows: LicenseImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push({
      rowNumber,
      software: software ? cellText(row.getCell(software).value) : '',
      usuario: usuario ? cellText(row.getCell(usuario).value) : '',
      correo: correo ? cellText(row.getCell(correo).value) : '',
      compartida: compartida ? cellText(row.getCell(compartida).value) : '',
      tipo: tipo ? cellText(row.getCell(tipo).value) : '',
      equipo: equipo ? cellText(row.getCell(equipo).value) : '',
      estado: estado ? cellText(row.getCell(estado).value) : '',
      fechaPago: fecha ? cellText(row.getCell(fecha).value) : '',
    });
  });
  return rows.filter((row) => row.software || row.usuario || row.correo);
}

export function licensesToWorkbook(subscriptions: Array<{
  product: { name: string; vendor: string | null };
  planName: string;
  currency: string;
  monthlyCost: number;
  annualCost: number;
  billingCycle: 'MONTHLY' | 'ANNUAL' | 'QUARTERLY' | 'OTHER';
  paymentDay: number | null;
  renewalDate: Date | null;
  displayStatus: string;
  seats: Array<{
    accountEmail: string | null;
    seatType: string;
    effectiveStatus?: string;
    status?: string;
    assignments: Array<{ unassignedAt: Date | null; employee: { fullName: string } }>;
  }>;
}>) {
  const rows: Array<Record<string, unknown>> = [];
  for (const subscription of subscriptions) {
    const schedule = formatPaymentSchedule(subscription);
    const seats = subscription.seats.length > 0 ? subscription.seats : [null];
    for (const seat of seats) {
      const active = seat?.assignments.filter((assignment) => assignment.unassignedAt === null) ?? [];
      const people = active.length > 0 ? active : [null];
      for (const assignment of people) {
        rows.push({
          software: subscription.product.name,
          vendor: subscription.product.vendor,
          plan: subscription.planName,
          email: seat?.accountEmail ?? '',
          seatType:
            seat?.seatType === 'INDIVIDUAL'
              ? 'Personal'
              : seat?.seatType === 'SHARED'
                ? 'Compartida'
                : seat?.seatType === 'DEVICE'
                  ? 'Equipo'
                  : '',
          equipmentCode:
            seat && 'equipment' in seat && seat.equipment && typeof seat.equipment === 'object'
              ? (seat.equipment as { inventoryCode?: string }).inventoryCode ?? ''
              : '',
          status: seat?.effectiveStatus ?? seat?.status ?? subscription.displayStatus,
          employee: assignment?.employee.fullName ?? '',
          currency: subscription.currency,
          monthlyCost: subscription.monthlyCost,
          annualCost: subscription.annualCost,
          payment: schedule,
        });
      }
    }
  }
  return toXlsx({
    reportTitle: 'Licencias de software',
    baseFilename: 'licencias-software',
    generatedAt: new Date(),
    currencySymbol: '$',
    columns: [
      { key: 'software', header: 'Software', type: 'text', width: 28 },
      { key: 'vendor', header: 'Proveedor', type: 'text', width: 22 },
      { key: 'plan', header: 'Plan', type: 'text', width: 18 },
      { key: 'email', header: 'Correo', type: 'text', width: 28 },
      { key: 'seatType', header: 'Tipo', type: 'text', width: 14 },
      { key: 'equipmentCode', header: 'Equipo', type: 'text', width: 16 },
      { key: 'status', header: 'Estado', type: 'text', width: 16 },
      { key: 'employee', header: 'Empleado', type: 'text', width: 28 },
      { key: 'currency', header: 'Moneda', type: 'text', width: 10 },
      { key: 'monthlyCost', header: 'Costo mensual', type: 'currency', width: 16 },
      { key: 'annualCost', header: 'Costo anual', type: 'currency', width: 16 },
      { key: 'payment', header: 'Fecha de pago', type: 'text', width: 20 },
    ],
    rows,
  });
}

export { HEADERS };
