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

export type BillingCycleForRenewal = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'OTHER';

function addUtcMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const d = date.getUTCDate();
  return new Date(Date.UTC(y, m, d));
}

function addUtcYears(date: Date, years: number): Date {
  return addUtcMonths(date, years * 12);
}

/** Avanza la fecha de renovación un ciclo (OTHER exige fecha explícita). */
export function advanceRenewalDate(
  current: Date | null,
  billingCycle: BillingCycleForRenewal,
  today: Date,
  explicitNext?: string | null,
): Date {
  if (billingCycle === 'OTHER') {
    if (!explicitNext) throw new Error('RENEWAL_DATE_REQUIRED');
    return new Date(`${explicitNext}T00:00:00.000Z`);
  }
  const base = current ?? today;
  switch (billingCycle) {
    case 'MONTHLY':
      return addUtcMonths(base, 1);
    case 'QUARTERLY':
      return addUtcMonths(base, 3);
    case 'ANNUAL':
      return addUtcYears(base, 1);
    default:
      return base;
  }
}
