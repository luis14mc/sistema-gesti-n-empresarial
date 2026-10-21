/** Guards: 'oficios.read' (GET), 'oficios.create' (POST) */
import {
  GET as getHandler,
  POST as postHandler,
} from '@/modules/oficios/presentation/handlers/collection.route';

export const GET = getHandler;
export const POST = postHandler;
