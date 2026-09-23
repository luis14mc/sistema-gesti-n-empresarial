export const SOFTWARE_BILLING_CYCLES = ['MONTHLY', 'ANNUAL', 'QUARTERLY', 'OTHER'] as const;
export const SOFTWARE_CURRENCIES = ['USD', 'HNL'] as const;

export type SoftwareBillingCycle = (typeof SOFTWARE_BILLING_CYCLES)[number];
export type SoftwareCurrency = (typeof SOFTWARE_CURRENCIES)[number];

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Monthly and annual equivalents of one billing period amount. OTHER uses the entered amount as the monthly equivalent. */
export function billingEquivalents(cycle: SoftwareBillingCycle, billingAmount: number): { monthlyCost: number; annualCost: number } {
  const amount = roundMoney(billingAmount);
  if (cycle === 'ANNUAL') return { monthlyCost: roundMoney(amount / 12), annualCost: amount };
  if (cycle === 'QUARTERLY') return { monthlyCost: roundMoney(amount / 3), annualCost: roundMoney(amount * 4) };
  return { monthlyCost: amount, annualCost: roundMoney(amount * 12) };
}

export function formatPaymentSchedule(input: {
  billingCycle: SoftwareBillingCycle;
  paymentDay?: number | null;
  renewalDate?: Date | string | null;
}): string {
  const day = input.paymentDay;
  if (input.billingCycle === 'MONTHLY' && day) return `${day} de cada mes`;
  if (input.billingCycle === 'QUARTERLY' && day) return `${day} de cada trimestre`;
  if (input.billingCycle === 'ANNUAL' && day && !input.renewalDate) return `${day} de cada año`;
  if (input.renewalDate) {
    const date = input.renewalDate instanceof Date ? input.renewalDate : new Date(input.renewalDate);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('es-HN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
    }
  }
  return 'Sin fecha de pago';
}

const PAYMENT_DAY = /(\d{1,2})\s*(?:de\s+)?cada\s+mes/i;

export function parsePaymentText(value: string | null | undefined): { billingCycle: SoftwareBillingCycle; paymentDay: number | null; renewalDate: string | null } {
  const text = (value ?? '').trim();
  const monthly = text.match(PAYMENT_DAY);
  if (monthly) {
    const paymentDay = Number(monthly[1]);
    if (paymentDay >= 1 && paymentDay <= 31) {
      return { billingCycle: 'MONTHLY', paymentDay, renewalDate: null };
    }
  }
  const parsed = Date.parse(text);
  if (text && !Number.isNaN(parsed)) {
    return { billingCycle: 'ANNUAL', paymentDay: null, renewalDate: new Date(parsed).toISOString().slice(0, 10) };
  }
  return { billingCycle: 'OTHER', paymentDay: null, renewalDate: null };
}
