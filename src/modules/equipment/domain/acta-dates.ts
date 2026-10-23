const PAYROLL_TZ = 'America/Tegucigalpa';

const MONTHS_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** "Tegucigalpa, M.D.C. — 10 agosto de 2026" */
export function formatActaHeaderDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('es-HN', {
    timeZone: PAYROLL_TZ,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(date);
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? '1');
  const monthIndex = Number(parts.find((p) => p.type === 'month')?.value ?? '1') - 1;
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const monthName = MONTHS_ES[monthIndex] ?? '';
  return `Tegucigalpa, M.D.C. — ${day} ${monthName} de ${year}`;
}

/** "Fecha: 10/08/2026" */
export function formatActaSignatureDate(date: Date): string {
  const formatted = new Intl.DateTimeFormat('es-HN', {
    timeZone: PAYROLL_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  return `Fecha: ${formatted}`;
}

/** dd/MM/yyyy sin prefijo */
export function formatActaShortDate(date: Date): string {
  return new Intl.DateTimeFormat('es-HN', {
    timeZone: PAYROLL_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
