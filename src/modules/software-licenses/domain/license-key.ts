const MASK = '•••••';

/** Muestra solo los últimos 5 caracteres; nunca usar en logs. */
export function maskLicenseKey(key: string | null | undefined): string | null {
  if (!key || key.trim().length === 0) return null;
  const trimmed = key.trim();
  if (trimmed.length <= 5) return `${MASK}${trimmed}`;
  return `${MASK}${trimmed.slice(-5)}`;
}
