import {
  DEPRECATED_API_MESSAGES,
  deprecatedApiHandler,
} from '@/platform/api/deprecated-api';

export const POST = deprecatedApiHandler(DEPRECATED_API_MESSAGES.tickets);
