import {
  DEPRECATED_API_MESSAGES,
  deprecatedApiHandler,
} from '@/platform/api/deprecated-api';

const handler = deprecatedApiHandler(DEPRECATED_API_MESSAGES.promotionalItems);

export const GET = handler;
export const POST = handler;
