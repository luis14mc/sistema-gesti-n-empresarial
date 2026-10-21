import { hashPassword } from '@/platform/security/authentication/auth';
import { generateSessionToken } from '@/platform/security/authentication/session-token';
import { createAuditRecord } from '@/platform/security/audit/audit-record';
import {
  createSessionUser,
  createUser,
  findUserByEmailOrEmployeeNumber,
  type NewUserData,
} from '@/modules/auth/infrastructure/credentials-repository';

export type RegisterInput = Omit<NewUserData, 'password'> & { password: string };

/** Alta por API: responde el usuario sin contraseña y deja auditoría. */
export async function registerUserFromApi(input: RegisterInput, actorUserId: string) {
  const { email, password, firstName, lastName, employeeNumber } = input;

  const existingUser = await findUserByEmailOrEmployeeNumber(email, employeeNumber);
  if (existingUser) return { kind: 'duplicate' as const };

  const hashedPassword = await hashPassword(password);
  const user = await createUser({ employeeNumber, email, password: hashedPassword, firstName, lastName });

  const { password: _, ...userWithoutPassword } = user;

  await createAuditRecord({
    title: 'Registro de usuario',
    description: `Se creó el usuario ${firstName} ${lastName} (${email})`,
    module: 'USUARIOS',
    category: 'CREATE',
    userId: actorUserId,
    entityId: user.id,
    newData: { email, employeeNumber, role: 'USER' },
  });

  return { kind: 'ok' as const, user: userWithoutPassword };
}

/** Alta por server action: genera token de sesión para el usuario creado. */
export async function registerUserWithSession(input: RegisterInput) {
  const { employeeNumber, email, password, firstName, lastName } = input;

  const existing = await findUserByEmailOrEmployeeNumber(email, employeeNumber);
  if (existing) {
    return {
      kind: 'duplicate' as const,
      field: existing.email === email ? 'email' : 'número de empleado',
    };
  }

  const hashedPassword = await hashPassword(password);
  const user = await createSessionUser({ employeeNumber, email, password: hashedPassword, firstName, lastName });

  const token = await generateSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return { kind: 'ok' as const, user, token };
}
