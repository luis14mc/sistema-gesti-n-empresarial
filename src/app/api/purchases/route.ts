import {
  DEPRECATED_API_MESSAGES,
  deprecatedApiHandler,
} from '@/lib/deprecated-api';

const handler = deprecatedApiHandler(DEPRECATED_API_MESSAGES.purchases);

export const GET = handler;
export const POST = handler;
