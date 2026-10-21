import { UserNotFoundError } from '@/modules/users/domain/errors';
import { countBlockingUserReferences } from '@/modules/users/infrastructure/user-reference-counts';
import { findActiveMembership } from '@/modules/users/infrastructure/user-repository';

export async function getDeleteEligibility(params: {
  organizationId: string;
  targetUserId: string;
  actorUserId: string;
}) {
  const membership = await findActiveMembership(params.organizationId, params.targetUserId);
  if (!membership) {
    throw new UserNotFoundError();
  }

  const referenceCount = await countBlockingUserReferences(params.targetUserId);
  return {
    canHardDelete: referenceCount === 0 && params.targetUserId !== params.actorUserId,
    referenceCount,
  };
}
