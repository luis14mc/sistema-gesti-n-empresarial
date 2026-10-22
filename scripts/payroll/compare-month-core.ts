export const PAYROLL_COMPARE_FIELDS = ['salario', 'ihss', 'isr', 'otro', 'neto'] as const;
export type PayrollCompareField = (typeof PAYROLL_COMPARE_FIELDS)[number];

export type LegacyPayrollRow = Record<PayrollCompareField, number> & { codigo: string };

export type SgePayrollAmounts = Record<PayrollCompareField, number>;

export const PAYROLL_COMPARE_THRESHOLD = 0.01;

export function parsePayMonth(monthArg: string): { year: number; month: number; label: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(monthArg.trim());
  if (!match) {
    throw new Error('Invalid --month; use YYYY-MM');
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error('Invalid --month; month must be 01-12');
  }
  return { year, month, label: `${year}-${String(month).padStart(2, '0')}` };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function parseAmount(raw: string, field: string, lineNo: number): number {
  const normalized = raw.replace(/\s/g, '').replace(/^L\.?/i, '');
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid number for ${field} at line ${lineNo}: ${raw}`);
  }
  return Math.round(value * 100) / 100;
}

export function parseLegacyPayrollCsv(content: string): Map<string, LegacyPayrollRow> {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    throw new Error('CSV is empty');
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const expected = ['codigo', ...PAYROLL_COMPARE_FIELDS];
  for (const col of expected) {
    if (!header.includes(col)) {
      throw new Error(`CSV header must include: ${expected.join(',')}`);
    }
  }

  const index = Object.fromEntries(header.map((name, i) => [name, i])) as Record<string, number>;
  const rows = new Map<string, LegacyPayrollRow>();

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const codigo = cells[index.codigo]?.trim();
    if (!codigo) continue;

    const row: LegacyPayrollRow = {
      codigo,
      salario: parseAmount(cells[index.salario] ?? '', 'salario', i + 1),
      ihss: parseAmount(cells[index.ihss] ?? '', 'ihss', i + 1),
      isr: parseAmount(cells[index.isr] ?? '', 'isr', i + 1),
      otro: parseAmount(cells[index.otro] ?? '', 'otro', i + 1),
      neto: parseAmount(cells[index.neto] ?? '', 'neto', i + 1),
    };
    rows.set(codigo, row);
  }

  return rows;
}

export interface PayrollCompareDiffRow {
  codigo: string;
  campo: PayrollCompareField;
  sge: number;
  anterior: number;
  diferencia: number;
}

export function diffPayrollRows(
  codigo: string,
  legacy: LegacyPayrollRow,
  sge: SgePayrollAmounts,
  threshold = PAYROLL_COMPARE_THRESHOLD,
): PayrollCompareDiffRow[] {
  const diffs: PayrollCompareDiffRow[] = [];
  for (const field of PAYROLL_COMPARE_FIELDS) {
    const anterior = legacy[field];
    const sgeValue = sge[field];
    const diferencia = Math.round((sgeValue - anterior) * 100) / 100;
    if (Math.abs(diferencia) > threshold) {
      diffs.push({ codigo, campo: field, sge: sgeValue, anterior, diferencia });
    }
  }
  return diffs;
}

export function buildCompareReportRows(
  legacyByCode: Map<string, LegacyPayrollRow>,
  sgeByCode: Map<string, SgePayrollAmounts>,
  threshold = PAYROLL_COMPARE_THRESHOLD,
): { diffs: PayrollCompareDiffRow[]; compared: number; matches: number } {
  let compared = 0;
  let matches = 0;
  const diffs: PayrollCompareDiffRow[] = [];

  for (const [codigo, legacy] of legacyByCode) {
    const sge = sgeByCode.get(codigo);
    if (!sge) continue;
    compared++;
    const rowDiffs = diffPayrollRows(codigo, legacy, sge, threshold);
    if (rowDiffs.length === 0) {
      matches++;
    } else {
      diffs.push(...rowDiffs);
    }
  }

  diffs.sort((a, b) => a.codigo.localeCompare(b.codigo) || a.campo.localeCompare(b.campo));
  return { diffs, compared, matches };
}

export function formatCompareCsv(rows: PayrollCompareDiffRow[]): string {
  const header = 'codigo,campo,sge,anterior,diferencia';
  const body = rows.map(
    (r) =>
      `${r.codigo},${r.campo},${r.sge.toFixed(2)},${r.anterior.toFixed(2)},${r.diferencia.toFixed(2)}`,
  );
  return [header, ...body].join('\n') + (body.length ? '\n' : '');
}
