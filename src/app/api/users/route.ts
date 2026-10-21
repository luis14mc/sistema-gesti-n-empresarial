import { withAuth } from '@/lib/middleware';
import {
  getUsersCollectionGetHandler,
  getUsersCollectionPatchHandler,
  getUsersCollectionPostHandler,
} from '@/modules/users/application/users-collection-service';

export const GET = withAuth(getUsersCollectionGetHandler);
export const POST = withAuth(getUsersCollectionPostHandler);
export const PATCH = withAuth(getUsersCollectionPatchHandler);
