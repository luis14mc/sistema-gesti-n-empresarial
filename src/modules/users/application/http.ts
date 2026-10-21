import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { authorizationFailure } from '@/platform/security/authorization/http';
import { PermissionDeniedError } from '@/platform/domain/errors';
import { NextResponse } from 'next/server';

export function usersAuthorizationFailure(error: unknown, requestId: string) {
  const denied = authorizationFailure(error, requestId);
  if (denied) return denied;
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (isOrganizationContextError(error)) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}
