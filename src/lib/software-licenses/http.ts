import { ZodError } from 'zod';
import { apiFailure } from '@/platform/api/response';
import { authorizationFailure } from '@/platform/security/authorization/http';
import { isOrganizationContextError } from '@/modules/organizations/application/context';

const MESSAGES: Record<string, string> = {
  SUBSCRIPTION_NOT_FOUND: 'La suscripción no existe en esta organización.',
  SEAT_NOT_FOUND: 'El asiento no existe en esta organización.',
  EMPLOYEE_NOT_FOUND: 'El empleado no existe en esta organización.',
  EMPLOYEE_INACTIVE: 'Solo se pueden asignar empleados activos.',
  EMPLOYEE_ALREADY_ASSIGNED: 'Ese empleado ya tiene una asignación activa en el asiento.',
  SEAT_NOT_ASSIGNABLE: 'El asiento no admite otra asignación.',
  SEAT_LIMIT_REACHED: 'La suscripción ya tiene todos los asientos contratados.',
  SEAT_STILL_ASSIGNED: 'Quite las asignaciones activas antes de marcar el asiento como disponible.',
  SHARED_SEAT_HAS_MULTIPLE_ASSIGNMENTS: 'Un asiento compartido con varias personas no puede volver a individual.',
  CROSS_ORGANIZATION_ASSIGNMENT: 'El empleado pertenece a otra organización.',
  ASSIGNMENT_NOT_FOUND: 'La asignación no existe o ya fue cerrada.',
  MISSING_SOFTWARE_COLUMN: 'El archivo debe incluir la columna Software.',
};

export function licenseFailure(error: unknown, requestId: string) {
  const denied = authorizationFailure(error, requestId);
  if (denied) return denied;
  if (isOrganizationContextError(error)) {
    return apiFailure(error.code, 'No existe una organización activa para este usuario.', { requestId, status: error.status, stage: 'RESOLVE_ORGANIZATION_CONTEXT' });
  }
  if (error instanceof ZodError) {
    return apiFailure('INVALID_LICENSE', 'Los datos de la licencia no son válidos.', { requestId, status: 400, details: error.issues, stage: 'VALIDATE' });
  }
  const code = error instanceof Error ? error.message : 'LICENSE_ERROR';
  return apiFailure(code, MESSAGES[code] ?? 'No se pudo completar la operación de licencias.', {
    requestId,
    status: code.endsWith('NOT_FOUND') ? 404 : 400,
    stage: 'LICENSE',
  });
}
