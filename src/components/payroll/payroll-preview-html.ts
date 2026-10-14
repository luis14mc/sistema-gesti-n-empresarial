import { formatLempiras } from '@/modules/payroll/application/mappers';
import type { PayslipPreview } from '@/services/payroll.service';

export function buildMinimalPayslipHtml(
  preview: PayslipPreview,
  employee: { fullName: string; employeeCode?: string | null },
  payMonth: string,
): string {
  const period =
    preview.payPeriod != null
      ? `${preview.payPeriod.start} – ${preview.payPeriod.end}`
      : payMonth;

  const row = (label: string, value: string, neto = false) =>
    `<tr${neto ? ' class="neto"' : ''}><td>${label}</td><td>${value}</td></tr>`;

  const table = [
    row('Salario del periodo', formatLempiras(preview.salarioPeriodo)),
    row('IHSS', formatLempiras(preview.ihss)),
    row('ISR', formatLempiras(preview.isr)),
    row('Otras deducciones', formatLempiras(preview.otro)),
    row('Total deducciones', formatLempiras(preview.totalDeducciones)),
    row('Neto a pagar', formatLempiras(preview.neto), true),
  ].join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Boleta ${employee.fullName}</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#fff;color:#111}
h1{font-size:1.25rem;color:#233981;margin:0 0 4px}
.meta{color:#64748b;font-size:0.875rem;margin-bottom:16px}
table{width:100%;border-collapse:collapse;font-size:0.9375rem}
td{padding:8px 12px;border-bottom:1px solid #e5e7eb}
td:last-child{text-align:right;font-variant-numeric:tabular-nums}
tr.neto td{font-weight:700;font-size:1rem;border-top:2px solid #233981;border-bottom:none}
</style></head><body>
<h1>Recibo de pago</h1>
<p class="meta">${employee.fullName}${employee.employeeCode ? ` · ${employee.employeeCode}` : ''}<br/>Periodo ${period}</p>
<table>${table}</table>
</body></html>`;
}
