export class PayrollDomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'PayrollDomainError';
  }
}

export class EmployeeNotYetHiredError extends PayrollDomainError {
  constructor() {
    super('Employee hire date is after the payroll year', 'EMPLOYEE_NOT_YET_HIRED');
  }
}

export class PayrollInvalidRateUnitsError extends PayrollDomainError {
  constructor() {
    super(
      'Las tasas ISR deben estar en porcentaje (p. ej. 15), no como fracción (0.15).',
      'PAYROLL_INVALID_RATE_UNITS',
    );
  }
}
