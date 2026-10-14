import { renderHtmlToPdf } from '@/lib/compras/pdf-renderer';
import { formatLempiras } from '@/modules/payroll/application/mappers';

export type PayslipAuditRow = {
  generatedAt: Date;
  employeeCode: string | null;
  employeeName: string;
  positionName: string | null;
  periodStart: Date;
  periodEnd: Date;
  salarioPeriodo: number;
  ihss: number;
  isr: number;
  otro: number;
  totalDeducciones: number;
  neto: number;
  deliveryType: string;
};

function formatDate(d: Date): string {
  return d.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function deliveryLabel(type: string): string {
  if (type === 'EMAIL') return 'Email';
  if (type === 'PDF_EMAIL') return 'PDF+Email';
  return 'PDF';
}

export function buildPayslipAuditHtml(rows: PayslipAuditRow[], filterLabel: string): string {
  const generated = formatDate(new Date());
  const headerCells = [
    'Fecha',
    'Cód.',
    'Empleado',
    'Cargo',
    'Periodo',
    'Salario',
    'IHSS',
    'ISR',
    'Otro',
    'Deducc.',
    'Neto',
    'Tipo',
  ];

  const bodyRows = rows
    .map((r, i) => {
      const bg = i % 2 === 0 ? '#f5f7fa' : '#ffffff';
      const period = `${formatDate(r.periodStart)}-${formatDate(r.periodEnd)}`;
      const cells = [
        formatDate(r.generatedAt),
        r.employeeCode ?? '—',
        r.employeeName.slice(0, 28),
        (r.positionName ?? '—').slice(0, 22),
        period,
        formatLempiras(r.salarioPeriodo),
        formatLempiras(r.ihss),
        formatLempiras(r.isr),
        formatLempiras(r.otro),
        formatLempiras(r.totalDeducciones),
        formatLempiras(r.neto),
        deliveryLabel(r.deliveryType),
      ];
      return `<tr style="background:${bg}">${cells
        .map((c, j) => {
          const align = j === 0 || j === 1 || j === 4 || j === 11 ? 'center' : j >= 5 && j <= 10 ? 'right' : 'left';
          return `<td style="padding:4px 6px;font-size:9px;text-align:${align};border-bottom:1px solid #e2e8f0;">${c}</td>`;
        })
        .join('')}</tr>`;
    })
    .join('');

  const totalsNeto = rows.reduce((s, r) => s + r.neto, 0);
  const totalsDed = rows.reduce((s, r) => s + r.totalDeducciones, 0);

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Auditoría de planilla</title>
  <style>
    @page { size: landscape; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #0f172a; margin: 0; }
    .banner { background: #233981; color: #fff; padding: 12px 16px; margin-bottom: 12px; }
    h1 { margin: 0; font-size: 16px; }
    .sub { opacity: 0.85; font-size: 9px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #233981; color: #fff; padding: 6px; font-size: 8px; text-transform: uppercase; }
    .footer { margin-top: 12px; color: #64748b; font-size: 9px; text-align: center; }
    .totals { margin-top: 8px; font-size: 10px; }
  </style>
</head>
<body>
  <div class="banner">
    <h1>Reporte de auditoría — Planilla</h1>
    <p class="sub">Sistema de Gestión Empresarial${filterLabel ? ` · Filtro: ${filterLabel}` : ''}</p>
  </div>
  <table>
    <thead><tr>${headerCells.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <p class="totals"><strong>Total registros:</strong> ${rows.length} · <strong>Neto:</strong> ${formatLempiras(totalsNeto)} · <strong>Deducciones:</strong> ${formatLempiras(totalsDed)}</p>
  <p class="footer">Generado: ${generated} · SGE Planilla</p>
</body>
</html>`;
}

export async function renderPayslipAuditPdf(rows: PayslipAuditRow[], filterLabel: string): Promise<Buffer> {
  const html = buildPayslipAuditHtml(rows, filterLabel);
  return renderHtmlToPdf(html);
}
