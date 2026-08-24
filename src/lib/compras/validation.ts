export function validateRtn(rtn?: string | null): boolean {
  if (!rtn) return true;
  const digits = rtn.replace(/\D/g, '');
  if (!digits) return true;
  if (digits.length < 8 || digits.length > 15) return false;
  if (/^0+$/.test(digits)) return false;
  return true;
}

export function normalizeRtn(rtn?: string | null): string | null {
  if (!rtn) return null;
  const digits = rtn.replace(/\D/g, '');
  return digits || null;
}
