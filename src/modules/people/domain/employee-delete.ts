export type EmployeeHistoryCounts = {
  assignments: number;
  licenseAssignments: number;
  payslips: number;
  oficios: number;
  purchaseOrders: number;
  linkedUser: boolean;
};

export function employeeHasHistory(counts: EmployeeHistoryCounts): boolean {
  return (
    counts.assignments > 0 ||
    counts.licenseAssignments > 0 ||
    counts.payslips > 0 ||
    counts.oficios > 0 ||
    counts.purchaseOrders > 0 ||
    counts.linkedUser
  );
}

export function formatEmployeeHistoryDetail(counts: EmployeeHistoryCounts): string {
  const parts: string[] = [];
  if (counts.assignments > 0) {
    parts.push(`${counts.assignments} asignación${counts.assignments === 1 ? '' : 'es'}`);
  }
  if (counts.licenseAssignments > 0) {
    parts.push(`${counts.licenseAssignments} licencia${counts.licenseAssignments === 1 ? '' : 's'}`);
  }
  if (counts.payslips > 0) {
    parts.push(`${counts.payslips} boleta${counts.payslips === 1 ? '' : 's'}`);
  }
  if (counts.oficios > 0) {
    parts.push(`${counts.oficios} oficio${counts.oficios === 1 ? '' : 's'}`);
  }
  if (counts.purchaseOrders > 0) {
    parts.push(`${counts.purchaseOrders} orden${counts.purchaseOrders === 1 ? '' : 'es'} de compra`);
  }
  if (counts.linkedUser) {
    parts.push('usuario del sistema vinculado');
  }
  return parts.join(', ');
}
