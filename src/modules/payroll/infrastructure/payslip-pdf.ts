import { renderHtmlToPdf } from '@/lib/compras/pdf-renderer';
import { getStorage } from '@/lib/storage';
import { formatLempiras } from '@/modules/payroll/application/mappers';

export interface PayslipPdfInput {
  organizationId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  year: number;
  month: number;
  periodStart: Date;
  periodEnd: Date;
  salarioPeriodo: number;
  ihss: number;
  isr: number;
  otro: number;
  totalDeducciones: number;
  neto: number;
}

function monthLabel(month: number): string {
  const labels = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  return labels[month - 1] ?? String(month);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function buildPayslipHtml(input: PayslipPdfInput): string {
  const periodLabel = `${formatDate(input.periodStart)} — ${formatDate(input.periodEnd)}`;
  const row = (label: string, value: string, bold = false) => `
    <tr>
      <td style="padding:6px 0;color:#334155;">${label}</td>
      <td style="padding:6px 0;text-align:right;font-weight:${bold ? '700' : '500'};color:#0f172a;">${value}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Recibo de planilla</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #0f172a; margin: 0; }
    .wrap { padding: 8px 4px; }
    h1 { font-size: 18px; margin: 0 0 4px; color: #233981; }
    .sub { color: #64748b; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    .box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin-top: 12px; }
    .net { background: #eef2ff; border-color: #233981; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Recibo de planilla</h1>
    <p class="sub">${monthLabel(input.month)} ${input.year} · Periodo ${periodLabel}</p>
    <p><strong>${input.employeeName}</strong>${input.employeeCode ? ` · Código ${input.employeeCode}` : ''}</p>
    <div class="box">
      <table>
        ${row('Salario del periodo', formatLempiras(input.salarioPeriodo))}
        ${row('IHSS', formatLempiras(input.ihss))}
        ${row('ISR', formatLempiras(input.isr))}
        ${row('Otras deducciones', formatLempiras(input.otro))}
        ${row('Total deducciones', formatLempiras(input.totalDeducciones), true)}
      </table>
    </div>
    <div class="box net">
      <table>
        ${row('Neto a pagar', formatLempiras(input.neto), true)}
      </table>
    </div>
  </div>
</body>
</html>`;
}

export async function renderAndStorePayslipPdf(input: PayslipPdfInput): Promise<string> {
  const html = buildPayslipHtml(input);
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
