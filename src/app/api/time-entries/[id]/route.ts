import {
  DEPRECATED_API_MESSAGES,
  deprecatedApiHandler,
} from '@/platform/api/deprecated-api';

const handler = deprecatedApiHandler(DEPRECATED_API_MESSAGES.timeEntries);

export const GET = handler;
export const PATCH = handler;
export const DELETE = handler;
