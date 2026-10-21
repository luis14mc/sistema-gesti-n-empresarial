import { formatLempiras } from '@/modules/payroll/application/mappers';
import { escapeHtml, formatPayrollDateHn, otroDeductionLabel } from './payslip-pdf';

export interface PayslipEmailHtmlInput {
  employeeName: string;
  periodStart: Date;
  periodEnd: Date;
  salarioPeriodo: number;
  isProrated?: boolean;
  ihss: number;
  isr: number;
  otro: number;
  otroConcepto?: string | null;
  totalDeducciones: number;
  neto: number;
  year: number;
}

/**
 * Correo de boleta idéntico al Sistema de Pagos CNI v2.2.0 (server.py · _enviar_email):
 * tablas con estilos inline (compatibles con Outlook), solo modo claro.
 */
export function buildPayslipEmail(input: PayslipEmailHtmlInput): { subject: string; html: string; text: string } {
  const fi = formatPayrollDateHn(input.periodStart);
  const ff = formatPayrollDateHn(input.periodEnd);
  const subject = `Boleta de Pago - ${fi} al ${ff}`;
  const salaryLabel = input.isProrated ? 'Salario (prorrateado por días)' : 'Salario Mensual';
  const otroLabel = otroDeductionLabel(input.otro, input.otroConcepto);
  const e = escapeHtml;

  const otroRow = otroLabel
    ? `<tr><td style="padding:10px 16px;background-color:#fafafa;border-bottom:1px solid #eeeeee;color:#666666;padding-left:24px">${e(otroLabel)}</td><td style="padding:10px 16px;background-color:#fafafa;border-bottom:1px solid #eeeeee;color:#cc0000;font-weight:600;text-align:right">-${e(formatLempiras(input.otro))}</td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;padding:32px 0">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden">
  <tr><td style="background-color:#233981;padding:28px 32px;text-align:center">
    <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700">Boleta de Pago</h1>
    <p style="margin:6px 0 0;color:#ffffff;font-size:12px;font-weight:400;opacity:0.8;letter-spacing:1px">CONSEJO NACIONAL DE INVERSIONES</p>
  </td></tr>
  <tr><td style="padding:28px 32px;background-color:#ffffff">
    <p style="margin:0 0 4px;font-size:14px;color:#333333">Estimado/a <strong>${e(input.employeeName)}</strong>,</p>
    <p style="margin:0 0 24px;font-size:13px;color:#666666">Adjunto su boleta de pago del periodo <strong style="color:#333333">${e(fi)}</strong> al <strong style="color:#333333">${e(ff)}</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border:1px solid #dddddd;border-radius:4px;overflow:hidden">
      <tr style="background-color:#233981">
        <td style="padding:12px 16px;color:#ffffff;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">Concepto</td>
        <td style="padding:12px 16px;color:#ffffff;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;text-align:right">Monto (L.)</td>
      </tr>
      <tr>
        <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #eeeeee;color:#333333;font-weight:600">${e(salaryLabel)}</td>
        <td style="padding:12px 16px;background-color:#ffffff;border-bottom:1px solid #eeeeee;color:#333333;font-weight:700;text-align:right;font-size:15px">${e(formatLempiras(input.salarioPeriodo))}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;background-color:#fafafa;border-bottom:1px solid #eeeeee;color:#666666;padding-left:24px">IHSS</td>
        <td style="padding:10px 16px;background-color:#fafafa;border-bottom:1px solid #eeeeee;color:#cc0000;font-weight:600;text-align:right">-${e(formatLempiras(input.ihss))}</td>
      </tr>
      <tr>
        <td style="padding:10px 16px;background-color:#ffffff;border-bottom:1px solid #eeeeee;color:#666666;padding-left:24px">ISR</td>
        <td style="padding:10px 16px;background-color:#ffffff;border-bottom:1px solid #eeeeee;color:#cc0000;font-weight:600;text-align:right">-${e(formatLempiras(input.isr))}</td>
      </tr>
      ${otroRow}
      <tr>
        <td style="padding:12px 16px;background-color:#fafafa;border-bottom:2px solid #dddddd;color:#333333;font-weight:600">Total Deducciones</td>
        <td style="padding:12px 16px;background-color:#fafafa;border-bottom:2px solid #dddddd;color:#cc0000;font-weight:700;text-align:right">-${e(formatLempiras(input.totalDeducciones))}</td>
      </tr>
      <tr>
        <td style="padding:16px;background-color:#233981;color:#ffffff;font-weight:700;font-size:15px">SALARIO NETO</td>
        <td style="padding:16px;background-color:#233981;color:#ffffff;font-weight:700;font-size:18px;text-align:right">${e(formatLempiras(input.neto))}</td>
      </tr>
    </table>
    <p style="margin:24px 0 0;font-size:11px;color:#999999;text-align:center">Boleta generada por el Sistema de Gestión Empresarial CNI. Si tiene consultas, contacte a Recursos Humanos.</p>
  </td></tr>
  <tr><td style="padding:16px 32px;background-color:#f5f5f5;text-align:center;border-top:1px solid #eeeeee">
    <p style="margin:0;font-size:11px;color:#999999">(c) ${input.year} Consejo Nacional de Inversiones - Honduras</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    `Estimado/a ${input.employeeName},`,
    '',
    `Adjunto su boleta de pago del periodo ${fi} al ${ff}.`,
    '',
    `${salaryLabel}: ${formatLempiras(input.salarioPeriodo)}`,
    `IHSS: -${formatLempiras(input.ihss)}`,
    `ISR: -${formatLempiras(input.isr)}`,
    ...(otroLabel ? [`${otroLabel}: -${formatLempiras(input.otro)}`] : []),
    `Total Deducciones: -${formatLempiras(input.totalDeducciones)}`,
    `SALARIO NETO: ${formatLempiras(input.neto)}`,
    '',
    'Si tiene consultas, contacte a Recursos Humanos.',
  ].join('\n');

  return { subject, html, text };
}
