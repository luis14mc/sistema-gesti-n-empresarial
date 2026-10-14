import { ZodError } from 'zod';
import { apiFailure } from '@/platform/api/response';
import { authorizationFailure } from '@/platform/security/authorization/http';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { EmployeeNotYetHiredError, PayrollDomainError } from '@/modules/payroll/domain';

const MESSAGES: Record<string, string> = {
  EMPLOYEE_NOT_FOUND: 'El empleado no existe en esta organización.',
  EMPLOYEE_NOT_PAYROLL_ENABLED: 'El empleado no está habilitado para planilla.',
  EMPLOYEE_MISSING_SALARY: 'El empleado no tiene salario mensual configurado.',
  EMPLOYEE_MISSING_HIRE_DATE: 'El empleado no tiene fecha de contratación.',
  PAYSLIP_NOT_FOUND: 'El recibo de planilla no existe.',
  INVALID_PAY_MONTH: 'El mes de pago no es válido (use YYYY-MM).',
  EMPLOYEE_NOT_YET_HIRED: 'La fecha de contratación es posterior al año del pago.',
  PDF_BROWSER_NOT_AVAILABLE: 'No se pudo generar el PDF en este entorno.',
};

export function payrollFailure(error: unknown, requestId: string) {
  const denied = authorizationFailure(error, requestId);
  if (denied) return denied;
  if (isOrganizationContextError(error)) {
    return apiFailure(error.code, 'No existe una organización activa para este usuario.', {
      requestId,
      status: error.status,
      stage: 'RESOLVE_ORGANIZATION_CONTEXT',
    });
  }
  if (error instanceof ZodError) {
    return apiFailure('INVALID_PAYROLL', 'Los datos de planilla no son válidos.', {
      requestId,
      status: 400,
      details: error.issues,
      stage: 'VALIDATE',
    });
  }
  if (error instanceof EmployeeNotYetHiredError || error instanceof PayrollDomainError) {
    return apiFailure(error.code, MESSAGES[error.code] ?? error.message, {
      requestId,
      status: 400,
      stage: 'PAYROLL_DOMAIN',
    });
  }
  const code = error instanceof Error ? error.message : 'PAYROLL_ERROR';
  return apiFailure(code, MESSAGES[code] ?? 'No se pudo completar la operación de planilla.', {
    requestId,
    status: code.endsWith('NOT_FOUND') ? 404 : 400,
    stage: 'PAYROLL',
  });
}
