import { renderHtmlToPdf } from '@/platform/pdf/html-to-pdf';
import { getStorage } from '@/platform/storage';
import { formatLempiras } from '@/modules/payroll/application/mappers';
import { CNI_PAYSLIP_LOGO_DATA_URI } from './cni-logo';

const PAYROLL_TZ = 'America/Tegucigalpa';
// Paleta exacta del Sistema de Pagos CNI v2.2.0 (fpdf RGB).
const CNI_BLUE = '#233981'; // (35, 57, 129)
const CNI_CYAN = '#2aaad6'; // (42, 170, 214)
const CNI_GREEN = '#1bae64'; // (27, 174, 100)
const DEDUCT_RED = '#b42828'; // (180, 40, 40)
const TEXT_DARK = '#323232'; // (50, 50, 50)
const ROW_LINE = '#dcdcdc'; // (220, 220, 220)
const HEADER_MUTED = '#c8d2e6'; // (200, 210, 230)
const FOOTER_GRAY = '#787878'; // (120, 120, 120)
const FOOTER_LIGHT = '#a0a0a0'; // (160, 160, 160)

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
  /** Primer mes con ingreso a mitad de periodo: etiqueta "Salario (prorrateado…)". */
  isProrated?: boolean;
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
  return 'Otra Deducción';
}

/**
 * Boleta idéntica al Sistema de Pagos CNI v2.2.0 (server.py · BoletaPDF, fpdf A4).
 */
export async function buildPayslipHtml(input: PayslipPdfInput): Promise<string> {
  const generatedAt = input.generatedAt ?? new Date();
  const periodLabel = `${formatPayrollDateHn(input.periodStart)} al ${formatPayrollDateHn(input.periodEnd)}`;
  const otroLabel = otroDeductionLabel(input.otro, input.otroConcepto);
  const salaryLabel = input.isProrated ? 'Salario (prorrateado por días trabajados)' : 'Salario Mensual';

  const employeeRows: Array<[string, string]> = [
    ['Código:', input.employeeCode ?? '—'],
    ['Nombre:', input.employeeName],
    ['Cargo:', input.positionName ?? '—'],
    ['Correo:', input.employeeEmail || 'N/A'],
    ['Periodo:', periodLabel],
  ];

  const deductionRows: Array<[string, string]> = [
    ['IHSS (Seguro Social)', formatLempiras(input.ihss)],
    ['ISR (Impuesto Sobre la Renta)', formatLempiras(input.isr)],
    ...(otroLabel ? [[otroLabel, formatLempiras(input.otro)] as [string, string]] : []),
  ];

  const row = (label: string, value: string, deduction: boolean) => `
      <div class="row">
        <span class="row-label">${escapeHtml(label)}</span>
        <span class="row-value${deduction ? ' deduct' : ''}">${escapeHtml(value)}</span>
      </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Boleta de pago ${escapeHtml(monthLabel(input.month))} ${input.year}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      width: 210mm; min-height: 297mm; position: relative;
      font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: ${TEXT_DARK};
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .header { position: absolute; left: 0; top: 0; width: 210mm; height: 44mm; background: ${CNI_BLUE}; }
    .cyan { position: absolute; left: 0; top: 44mm; width: 210mm; height: 2mm; background: ${CNI_CYAN}; z-index: 2; }
    .logo { position: absolute; left: 14mm; top: 6mm; width: 32mm; height: auto; }
    .titles { position: absolute; left: 0; top: 10mm; width: 210mm; text-align: center; color: #fff; }
    .titles h1 { margin: 0; height: 8mm; line-height: 8mm; font-size: 18pt; font-weight: 700; }
    .titles .org { height: 5mm; line-height: 5mm; font-size: 9pt; }
    .titles .country { height: 5mm; line-height: 5mm; font-size: 7pt; color: ${HEADER_MUTED}; }
    .content { position: absolute; left: 10mm; right: 10mm; top: 36mm; }
    .content .section:first-child { margin-bottom: 4mm; }
    .section { height: 8mm; line-height: 8mm; padding-left: 3mm; margin-bottom: 2mm;
      color: #fff; font-weight: 700; font-size: 9pt; background: ${CNI_BLUE}; }
    .section.income { background: ${CNI_GREEN}; }
    .section.deduction { background: ${DEDUCT_RED}; }
    .data { display: flex; height: 7mm; line-height: 7mm; }
    .data .k { width: 45mm; padding-left: 3mm; color: ${CNI_BLUE}; font-weight: 700; }
    .data .v { flex: 1; }
    .row { display: flex; height: 7mm; line-height: 7mm; margin: 0 0 0 5mm; width: 180mm;
      border-bottom: 0.2mm solid ${ROW_LINE}; }
    .row-label { width: 120mm; padding-left: 3mm; margin-left: -5mm; }
    .row-value { flex: 1; text-align: right; padding-right: 5mm; }
    .row-value.deduct { color: ${DEDUCT_RED}; }
    .total { display: flex; height: 8mm; line-height: 8mm; font-size: 10pt; font-weight: 700;
      margin-top: 1mm; border-top: 0.3mm solid currentColor; padding-top: 1mm; margin-left: 5mm; width: 180mm; }
    .total .t-label { width: 120mm; padding-left: 3mm; margin-left: -5mm; }
    .total .t-value { flex: 1; text-align: right; padding-right: 5mm; }
    .total.income { color: ${CNI_GREEN}; }
    .total.deduction { color: ${DEDUCT_RED}; }
    .gap4 { height: 4mm; } .gap6 { height: 6mm; }
    .net { display: flex; height: 14mm; line-height: 14mm; background: ${CNI_BLUE}; color: #fff;
      font-size: 14pt; font-weight: 700; }
    .net .n-label { width: 125mm; padding-left: 3mm; }
    .net .n-value { flex: 1; text-align: right; padding-right: 3mm; }
    .footer { position: absolute; left: 15mm; width: 180mm; bottom: 10mm; text-align: center;
      border-top: 0.2mm solid ${CNI_BLUE}; padding-top: 2mm; }
    .footer .gen { font-size: 7pt; color: ${FOOTER_GRAY}; height: 4mm; line-height: 4mm; }
    .footer .sys { font-size: 6pt; color: ${FOOTER_LIGHT}; height: 4mm; line-height: 4mm; }
  </style>
</head>
<body>
  <div class="header"></div>
  <div class="cyan"></div>
  <img class="logo" src="${CNI_PAYSLIP_LOGO_DATA_URI}" alt="CNI Honduras" />
  <div class="titles">
    <h1>BOLETA DE PAGO</h1>
    <div class="org">Consejo Nacional de Inversiones</div>
    <div class="country">Honduras, C.A.</div>
  </div>

  <div class="content">
    <div class="section">DATOS DEL EMPLEADO</div>
    ${employeeRows.map(([k, v]) => `<div class="data"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(v)}</span></div>`).join('\n    ')}
    <div class="gap4"></div>

    <div class="section income">INGRESOS</div>
    ${row(salaryLabel, formatLempiras(input.salarioPeriodo), false)}
    <div class="total income"><span class="t-label">Total Ingresos</span><span class="t-value">${escapeHtml(formatLempiras(input.salarioPeriodo))}</span></div>
    <div class="gap4"></div>

    <div class="section deduction">DEDUCCIONES</div>
    ${deductionRows.map(([label, value]) => row(label, value, true)).join('')}
    <div class="total deduction"><span class="t-label">Total Deducciones</span><span class="t-value">-${escapeHtml(formatLempiras(input.totalDeducciones))}</span></div>
    <div class="gap6"></div>

    <div class="net"><span class="n-label">SALARIO NETO</span><span class="n-value">${escapeHtml(formatLempiras(input.neto))}</span></div>
  </div>

  <div class="footer">
    <div class="gen">Generado: ${escapeHtml(formatPayrollDateTimeHn(generatedAt))}  |  Página 1</div>
    <div class="sys">Sistema de Gestión Empresarial · Planilla - Consejo Nacional de Inversiones</div>
  </div>
</body>
</html>`;
}

export async function renderAndStorePayslipPdf(input: PayslipPdfInput): Promise<string> {
  const html = await buildPayslipHtml(input);
  const buffer = await renderHtmlToPdf(html, {
    format: 'a4',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
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
