export function validateRtn(rtn?: string | null): boolean {
  if (!rtn) return true;
  const digits = rtn.replace(/\D/g, '');
  return digits.length === 14;
}

export function normalizeRtn(rtn?: string | null): string | null {
  if (!rtn) return null;
  const digits = rtn.replace(/\D/g, '');
  return digits || null;
}
