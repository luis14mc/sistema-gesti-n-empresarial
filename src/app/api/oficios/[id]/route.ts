/** Guards: 'oficios.read' (GET), 'oficios.update' (PATCH), 'oficios.deactivate' (DELETE) */
import {
  GET as getHandler,
  PATCH as patchHandler,
  DELETE as deleteHandler,
} from '@/modules/oficios/presentation/handlers/detail.route';

export const GET = getHandler;
export const PATCH = patchHandler;
export const DELETE = deleteHandler;
