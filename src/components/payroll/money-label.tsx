import { formatLempiras } from '@/modules/payroll/application/mappers';

export function MoneyLabel({ amount }: { amount: number }) {
  return <span>{formatLempiras(amount)}</span>;
}
