import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { authorizationFailure } from '@/platform/security/authorization/http';
import { DomainError, PermissionDeniedError } from '@/platform/domain/errors';
import { NextResponse } from 'next/server';
import {
  AdminRoleAlwaysAssignableError,
  ConfirmRetainMembersError,
  ConfirmSelfRoleChangeError,
  DenyLockedPermissionError,
  InvalidCredentialsError,
  InvalidRoleError,
  LastSuperAdminError,
  LockedPermissionsMissingError,
  MembershipNotFoundError,
  PasswordSameAsCurrentError,
  RoleMustHavePermissionsError,
  RoleNotAssignableError,
  UseSelfPasswordChangeError,
  UserEmailAlreadyRegisteredError,
  UserEmailInUseError,
  UserHasHistoryError,
  UserNotFoundError,
  UsersDomainError,
  ActorMembershipMissingError,
  CannotChangeOwnRoleError,
  CannotDeleteSelfError,
  CannotResetOwnerPasswordError,
  InvalidSessionError,
  InvalidProfileEmailError,
  InvalidProfileFieldError,
} from '@/modules/users/domain/errors';

export function handleUsersApiError(
  error: unknown,
  requestId: string,
  fallbackMessage: string,
): NextResponse {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  const domain = usersDomainErrorResponse(error);
  if (domain) return domain;
  const denied = usersAuthorizationFailure(error, requestId);
  if (denied) return denied;
  if (error instanceof DomainError) {
    return NextResponse.json({ error: error.message }, { status: error.httpStatus });
  }
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

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

export function usersDomainErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof UsersDomainError)) return null;

  if (error instanceof UserNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof UserEmailAlreadyRegisteredError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof UserEmailInUseError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof InvalidRoleError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof RoleNotAssignableError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof LastSuperAdminError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ConfirmSelfRoleChangeError) {
    return NextResponse.json(
      {
        error: error.code,
        message:
          'Perderá privilegios de administración si el nuevo rol no incluye Roles y permisos. Confirme para continuar.',
      },
      { status: 409 },
    );
  }
  if (error instanceof CannotChangeOwnRoleError || error instanceof CannotDeleteSelfError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof CannotResetOwnerPasswordError || error instanceof UseSelfPasswordChangeError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof InvalidCredentialsError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof PasswordSameAsCurrentError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof UserHasHistoryError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof MembershipNotFoundError || error instanceof ActorMembershipMissingError) {
    const status = error instanceof ActorMembershipMissingError ? 403 : 404;
    return NextResponse.json({ error: error.message }, { status });
  }
  if (error instanceof LockedPermissionsMissingError) {
    return NextResponse.json(
      { error: error.message, missing: error.missing },
      { status: 400 },
    );
  }
  if (error instanceof RoleMustHavePermissionsError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof DenyLockedPermissionError) {
    return NextResponse.json(
      { error: error.message, permissions: error.permissions },
      { status: 400 },
    );
  }
  if (error instanceof InvalidSessionError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof InvalidProfileEmailError || error instanceof InvalidProfileFieldError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof AdminRoleAlwaysAssignableError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ConfirmRetainMembersError) {
    return NextResponse.json(
      {
        error: error.code,
        memberCount: error.memberCount,
        message: `${error.memberCount} usuario(s) conservan este rol, pero no se podrá asignar a nuevos.`,
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ error: error.message }, { status: 400 });
}
