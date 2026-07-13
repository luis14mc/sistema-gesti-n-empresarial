import {
  DEPRECATED_API_MESSAGES,
  deprecatedApiHandler,
} from '@/lib/deprecated-api';

export const POST = deprecatedApiHandler(DEPRECATED_API_MESSAGES.purchases);
