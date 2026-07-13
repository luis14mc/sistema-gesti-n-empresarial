import {
  DEPRECATED_API_MESSAGES,
  deprecatedApiHandler,
} from '@/lib/deprecated-api';

const handler = deprecatedApiHandler(DEPRECATED_API_MESSAGES.promotionalItems);

export const GET = handler;
export const PATCH = handler;
export const DELETE = handler;
