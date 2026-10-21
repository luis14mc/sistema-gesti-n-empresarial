import { Prisma } from '@prisma/client';
import { ACTIVE_ASSIGNMENT_UNIQUE_INDEX } from '@/modules/equipment/domain/assignment-errors';

export { ACTIVE_ASSIGNMENT_UNIQUE_INDEX } from '@/modules/equipment/domain/assignment-errors';

/**
 * True when `error` is the Prisma unique-constraint violation (P2002) raised by
 * the active-assignment partial unique index.
 */
export function isActiveAssignmentConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (typeof target === 'string') return target.includes(ACTIVE_ASSIGNMENT_UNIQUE_INDEX);
  if (Array.isArray(target)) return target.some((t) => String(t).includes(ACTIVE_ASSIGNMENT_UNIQUE_INDEX));
  return typeof error.message === 'string' && error.message.includes(ACTIVE_ASSIGNMENT_UNIQUE_INDEX);
}
