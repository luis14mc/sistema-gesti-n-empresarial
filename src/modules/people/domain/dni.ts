const DNI_DIGITS_LENGTH = 13;

export function normalizeHondurasDni(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== DNI_DIGITS_LENGTH) {
    throw new Error('DNI_INVALIDO');
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
}

export function parseOptionalDni(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return normalizeHondurasDni(trimmed);
}
