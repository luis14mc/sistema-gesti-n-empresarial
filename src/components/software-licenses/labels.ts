export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activa',
  SUSPENDED: 'Suspendida',
  CANCELLED: 'Cancelada',
  EXPIRING_SOON: 'Por vencer',
  EXPIRED: 'Vencida',
  AVAILABLE: 'Disponible',
  ASSIGNED: 'Asignado',
  INDIVIDUAL: 'Individual',
  SHARED: 'Compartida',
  IN_7_DAYS: 'En 7 días',
  IN_15_DAYS: 'En 15 días',
  IN_30_DAYS: 'En 30 días',
};

export function moneyLabel(currency: string, amount: number) {
  return new Intl.NumberFormat('es-HN', {
    style: 'currency',
    currency: currency === 'HNL' ? 'HNL' : 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}
