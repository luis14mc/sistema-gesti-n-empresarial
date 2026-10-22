import { cookies } from 'next/headers';
import { findPageOrganizationMemberships } from '@/modules/organizations/infrastructure/organization-repository';

export async function requirePageOrganizationId(userId: string): Promise<string> {
  const selectedOrganizationId = (await cookies()).get('organizationId')?.value;
  const memberships = await findPageOrganizationMemberships(userId, selectedOrganizationId);
  if (memberships.length !== 1) throw new Error('ORGANIZATION_SELECTION_REQUIRED');
  return memberships[0].organizationId;
}
