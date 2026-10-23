import { DomainError } from '@/platform/domain/errors';
import type { EmployeeHistoryCounts } from '@/modules/people/domain/employee-delete';
import { formatEmployeeHistoryDetail } from '@/modules/people/domain/employee-delete';

export class EmployeeHasActiveAssetsError extends DomainError {
  readonly code = 'EMPLOYEE_HAS_ACTIVE_ASSETS';
  readonly httpStatus = 409;

  constructor(details: { equipos: string[]; licencias: string[] }) {
    super('Devuelva sus equipos y libere sus licencias antes de desactivarlo.', details);
  }
}

export class EmployeeHasHistoryError extends DomainError {
  readonly code = 'EMPLOYEE_HAS_HISTORY';
  readonly httpStatus = 409;

  constructor(counts: EmployeeHistoryCounts) {
    const detail = formatEmployeeHistoryDetail(counts);
    super(`No se puede eliminar porque tiene historial (${detail}). Desactívelo en su lugar.`, counts);
  }
}

export class EmployeeDuplicateFieldError extends DomainError {
  readonly code = 'EMPLOYEE_DUPLICATE';
  readonly httpStatus = 409;

  constructor(field: 'email' | 'employeeCode') {
    super(
      field === 'email'
        ? 'El correo ya está registrado para otro empleado en esta organización.'
        : 'El código de empleado ya está registrado en esta organización.',
      { field },
    );
  }
}
