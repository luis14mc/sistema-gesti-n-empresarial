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
