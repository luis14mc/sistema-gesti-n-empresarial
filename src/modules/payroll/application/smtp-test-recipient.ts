import { findUserEmailById } from '@/modules/payroll/infrastructure/user-email-repository';

/** Correo del usuario que solicita la prueba SMTP (destinatario del mensaje de prueba). */
export function findUserEmail(userId: string): Promise<string | null | undefined> {
  return findUserEmailById(userId);
}
