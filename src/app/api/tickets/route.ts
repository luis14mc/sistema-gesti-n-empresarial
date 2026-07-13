import {
  DEPRECATED_API_MESSAGES,
  deprecatedApiHandler,
} from '@/lib/deprecated-api';

const handler = deprecatedApiHandler(DEPRECATED_API_MESSAGES.tickets);

export const GET = handler;
export const POST = handler;
