export const DEFAULT_EXPIRING_SOON_DAYS = 30;

export type StoredSubscriptionStatus = 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
export type DisplaySubscriptionStatus = StoredSubscriptionStatus | 'EXPIRING_SOON' | 'EXPIRED';
export type RenewalAlert = 'EXPIRED' | 'IN_7_DAYS' | 'IN_15_DAYS' | 'IN_30_DAYS';

export function calendarDaysUntil(renewalDate: Date, today: Date): number {
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const end = Date.UTC(renewalDate.getUTCFullYear(), renewalDate.getUTCMonth(), renewalDate.getUTCDate());
  return Math.round((end - start) / 86_400_000);
}

export function renewalAlert(renewalDate: Date | null, today: Date, status: StoredSubscriptionStatus): RenewalAlert | null {
  if (!renewalDate || status === 'CANCELLED') return null;
  const days = calendarDaysUntil(renewalDate, today);
  if (days < 0) return 'EXPIRED';
  if (days <= 7) return 'IN_7_DAYS';
  if (days <= 15) return 'IN_15_DAYS';
  if (days <= 30) return 'IN_30_DAYS';
  return null;
}

export function displaySubscriptionStatus(
  status: StoredSubscriptionStatus,
  renewalDate: Date | null,
  today: Date,
  expiringSoonDays = DEFAULT_EXPIRING_SOON_DAYS,
): DisplaySubscriptionStatus {
  if (status === 'SUSPENDED' || status === 'CANCELLED') return status;
  if (!renewalDate) return 'ACTIVE';
  const days = calendarDaysUntil(renewalDate, today);
  if (days < 0) return 'EXPIRED';
  if (days <= expiringSoonDays) return 'EXPIRING_SOON';
  return 'ACTIVE';
}
