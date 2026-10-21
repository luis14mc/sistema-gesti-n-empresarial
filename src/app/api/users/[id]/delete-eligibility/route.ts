import { withAuth } from '@/lib/middleware';
import { getUserDeleteEligibility } from '@/modules/users/application/user-delete-eligibility-service';

export const GET = withAuth(getUserDeleteEligibility);
