import { renderHtmlToPdf } from '@/lib/compras/pdf-renderer';
import { resolveInstitutionLogoDataUri } from '@/lib/compras/institution';
import { getStorage } from '@/lib/storage';
import { formatLempiras } from '@/modules/payroll/application/mappers';

const PAYROLL_TZ = 'America/Tegucigalpa';
const BRAND_BLUE = '#233981';
const BRAND_SKY = '#5eb8e8';
const INCOME_GREEN = '#1fae6b';
const DEDUCT_RED = '#b3261e';

export interface PayslipPdfInput {
  organizationId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  employeeEmail: string;
  positionName: string | null;
  year: number;
  month: number;
  periodStart: Date;
  periodEnd: Date;
  salarioPeriodo: number;
  ihss: number;
  isr: number;
  otro: number;
  otroConcepto?: string | null;
  totalDeducciones: number;
  neto: number;
  generatedAt?: Date;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function monthLabel(month: number): string {
  const labels = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return labels[month - 1] ?? String(month);
}

export function formatPayrollDateHn(date: Date): string {
  return new Intl.DateTimeFormat('es-HN', {
    timeZone: PAYROLL_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatPayrollDateTimeHn(date: Date): string {
  const datePart = formatPayrollDateHn(date);
  const timePart = new Intl.DateTimeFormat('es-HN', {
    timeZone: PAYROLL_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${datePart} ${timePart}`;
}

export function otroDeductionLabel(otro: number, concepto?: string | null): string | null {
  if (otro <= 0) return null;
  if (concepto?.trim()) return `Otro (${concepto.trim()})`;
  return 'Otro';
}

export async function buildPayslipHtml(input: PayslipPdfInput): Promise<string> {
  const logoUri = await resolveInstitutionLogoDataUri();
  const generatedAt = input.generatedAt ?? new Date();
  const periodLabel = `${formatPayrollDateHn(input.periodStart)} al ${formatPayrollDateHn(input.periodEnd)}`;
  const otroLabel = otroDeductionLabel(input.otro, input.otroConcepto);
  const deductionRows = [
    { label: 'IHSS (Seguro Social)', value: formatLempiras(input.ihss) },
    { label: 'ISR (Impuesto Sobre la Renta)', value: formatLempiras(input.isr) },
    ...(otroLabel ? [{ label: otroLabel, value: formatLempiras(input.otro) }] : []),
  ];

  const deductionRowsHtml = deductionRows.map((row) => `
    <tr>
      <td style="padding:8px 12px;color:#334155;">${escapeHtml(row.label)}</td>
      <td style="padding:8px 12px;text-align:right;color:${DEDUCT_RED};font-weight:600;">${escapeHtml(row.value)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Boleta de pago ${escapeHtml(monthLabel(input.month))} ${input.year}</title>
  <style>
    @page { size: letter portrait; margin: 14mm 12mm 16mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #0f172a; margin: 0; }
    .header { background: ${BRAND_BLUE}; color: #fff; padding: 18px 20px 10px; position: relative; }
    .header-inner { display: flex; align-items: center; gap: 16px; }
    .logo { width: 72px; height: 72px; object-fit: contain; filter: brightness(0) invert(1); }
    .header-title { flex: 1; text-align: center; }
    .header-title h1 { margin: 0; font-size: 22px; letter-spacing: 0.04em; }
    .header-title p { margin: 4px 0 0; font-size: 12px; }
    .sky-bar { height: 6px; background: ${BRAND_SKY}; }
    .section { margin-top: 18px; border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; }
    .section-title { font-weight: 700; color: ${BRAND_BLUE}; padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .data-grid { padding: 12px 14px; display: grid; grid-template-columns: 140px 1fr; row-gap: 8px; column-gap: 8px; }
    .data-grid dt { font-weight: 700; color: ${BRAND_BLUE}; margin: 0; }
    .data-grid dd { margin: 0; color: #0f172a; }
    .bar-green { background: ${INCOME_GREEN}; color: #fff; font-weight: 700; padding: 8px 12px; }
    .bar-red { background: ${DEDUCT_RED}; color: #fff; font-weight: 700; padding: 8px 12px; }
    .bar-blue { background: ${BRAND_BLUE}; color: #fff; font-weight: 700; padding: 10px 12px; font-size: 13px; }
    table.amounts { width: 100%; border-collapse: collapse; }
    .net-row td { padding: 12px; font-size: 14px; font-weight: 700; color: #fff; }
    .footer { margin-top: 24px; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-inner">
      <img class="logo" src="${logoUri}" alt="CNI" />
      <div class="header-title">
        <h1>BOLETA DE PAGO</h1>
        <p>Consejo Nacional de Inversiones</p>
        <p>Honduras, C.A.</p>
      </div>
      <div style="width:72px;"></div>
    </div>
  </header>
  <div class="sky-bar"></div>

  <section class="section">
    <div class="section-title">DATOS DEL EMPLEADO</div>
    <dl class="data-grid">
      <dt>Código</dt><dd>${escapeHtml(input.employeeCode ?? '—')}</dd>
      <dt>Nombre</dt><dd>${escapeHtml(input.employeeName)}</dd>
      <dt>Cargo</dt><dd>${escapeHtml(input.positionName ?? '—')}</dd>
      <dt>Correo</dt><dd>${escapeHtml(input.employeeEmail)}</dd>
      <dt>Periodo</dt><dd>${escapeHtml(periodLabel)}</dd>
    </dl>
  </section>

  <section class="section">
    <div class="bar-green">INGRESOS</div>
    <table class="amounts">
      <tr>
        <td style="padding:8px 12px;">Salario Mensual</td>
        <td style="padding:8px 12px;text-align:right;color:${INCOME_GREEN};font-weight:600;">${escapeHtml(formatLempiras(input.salarioPeriodo))}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-weight:700;color:${INCOME_GREEN};">Total Ingresos</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:${INCOME_GREEN};">${escapeHtml(formatLempiras(input.salarioPeriodo))}</td>
      </tr>
    </table>
  </section>

  <section class="section">
    <div class="bar-red">DEDUCCIONES</div>
    <table class="amounts">
      ${deductionRowsHtml}
      <tr>
        <td style="padding:8px 12px;font-weight:700;color:${DEDUCT_RED};">Total Deducciones</td>
        <td style="padding:8px 12px;text-align:right;font-weight:700;color:${DEDUCT_RED};">-${escapeHtml(formatLempiras(input.totalDeducciones))}</td>
      </tr>
    </table>
  </section>

  <section class="section">
    <div class="bar-blue">SALARIO NETO</div>
    <table class="amounts">
      <tr class="net-row">
        <td>Salario neto del periodo</td>
        <td style="text-align:right;">${escapeHtml(formatLempiras(input.neto))}</td>
      </tr>
    </table>
  </section>

  <footer class="footer">
    <span>Generado: ${escapeHtml(formatPayrollDateTimeHn(generatedAt))} | Página 1</span>
    <span>SGE — Consejo Nacional de Inversiones</span>
  </footer>
</body>
</html>`;
}

export async function renderAndStorePayslipPdf(input: PayslipPdfInput): Promise<string> {
  const html = await buildPayslipHtml(input);
  const buffer = await renderHtmlToPdf(html);
  const prefix = `organizations/${input.organizationId}/payroll/${input.year}/${input.month}`;
  const stored = await getStorage().put({
    prefix,
    originalName: `${input.employeeId}.pdf`,
    mimeType: 'application/pdf',
    size: buffer.length,
    buffer,
    desiredName: `${input.employeeId}.pdf`,
  });
  return stored.key;
}
