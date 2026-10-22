import { DomainError } from '@/platform/domain/errors';

export class EmployeeHasActiveAssetsError extends DomainError {
  readonly code = 'EMPLOYEE_HAS_ACTIVE_ASSETS';
  readonly httpStatus = 409;

  constructor(details: { equipos: string[]; licencias: string[] }) {
    super('Devuelva sus equipos y libere sus licencias antes de desactivarlo.', details);
  }
}
