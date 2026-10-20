type EnvSource = Record<string, string | undefined>;

export function truncateDeliveryError(message: string, env: EnvSource = process.env): string {
  let sanitized = message;
  const password = env.SMTP_PASSWORD?.trim();
  if (password) {
    sanitized = sanitized.split(password).join('[redacted]');
  }
  const user = env.SMTP_USER?.trim();
  if (user) {
    sanitized = sanitized.split(user).join('[redacted]');
  }
  sanitized = sanitized
    .replace(/SMTP_PASSWORD[^\s]*/gi, '[redacted]')
    .replace(/password[=:]\S+/gi, 'password=[redacted]');
  return sanitized.slice(0, 500);
}
