import { Prisma } from '@prisma/client';

/**
 * Name of the partial unique index enforcing the invariant
 * "one ACTIVE assignment per equipment item" (migration
 * 20260803120000_equipment_assignment_active_unique).
 */
export const ACTIVE_ASSIGNMENT_UNIQUE_INDEX =
  'equipment_assignments_one_active_per_equipment';

/**
 * True when `error` is the Prisma unique-constraint violation (P2002) raised by
 * the active-assignment partial unique index. This is the database-level
 * concurrency backstop: even if two requests race past the application-level
 * pre-check, exactly one INSERT survives and the loser lands here.
 */
export function isActiveAssignmentConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;
  const target = error.meta?.target;
  // pg adapter reports the constraint/index name; be tolerant of shape.
  if (typeof target === 'string') return target.includes(ACTIVE_ASSIGNMENT_UNIQUE_INDEX);
  if (Array.isArray(target)) return target.some((t) => String(t).includes(ACTIVE_ASSIGNMENT_UNIQUE_INDEX));
  // Some adapters omit meta.target; fall back to the message.
  return typeof error.message === 'string' && error.message.includes(ACTIVE_ASSIGNMENT_UNIQUE_INDEX);
}
