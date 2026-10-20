const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function maskEmailAddress(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return '***';
  return `${local[0]}***@${domain}`;
}

export function redactEmailsInText(text: string): string {
  return text.replace(EMAIL_PATTERN, (match) => maskEmailAddress(match));
}

export function redactEmailsInJson(value: unknown): unknown {
  if (typeof value === 'string') return redactEmailsInText(value);
  if (Array.isArray(value)) return value.map((item) => redactEmailsInJson(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, redactEmailsInJson(nested)]),
    );
  }
  return value;
}
