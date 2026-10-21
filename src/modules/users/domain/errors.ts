export class UsersDomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'UsersDomainError';
  }
}

export class UserNotFoundError extends UsersDomainError {
  constructor() {
    super('Usuario no encontrado', 'USER_NOT_FOUND');
  }
}

export class UserEmailAlreadyRegisteredError extends UsersDomainError {
  constructor() {
    super('El email ya está registrado', 'EMAIL_ALREADY_REGISTERED');
  }
}

export class UserEmailInUseError extends UsersDomainError {
  constructor() {
    super('Email ya en uso', 'EMAIL_IN_USE');
  }
}

export class InvalidProfileEmailError extends UsersDomainError {
  constructor() {
    super('Email inválido', 'INVALID_PROFILE_EMAIL');
  }
}

export class InvalidProfileFieldError extends UsersDomainError {
  constructor(message: string) {
    super(message, 'INVALID_PROFILE_FIELD');
  }
}

export class InvalidRoleError extends UsersDomainError {
  constructor(message = 'Rol no válido') {
    super(message, 'INVALID_ROLE');
  }
}

export class RoleNotAssignableError extends UsersDomainError {
  constructor() {
    super('Este rol no está disponible para asignación', 'ROLE_NOT_ASSIGNABLE');
  }
}

export class CannotChangeOwnRoleError extends UsersDomainError {
  constructor() {
    super('No puedes cambiar tu propio rol', 'CANNOT_CHANGE_OWN_ROLE');
  }
}

export class CannotDeleteSelfError extends UsersDomainError {
  constructor() {
    super('No puedes eliminar tu propia cuenta', 'CANNOT_DELETE_SELF');
  }
}

export class CannotResetOwnerPasswordError extends UsersDomainError {
  constructor() {
    super('No puede restablecer la contraseña de un propietario', 'CANNOT_RESET_OWNER_PASSWORD');
  }
}

export class UseSelfPasswordChangeError extends UsersDomainError {
  constructor() {
    super('Use el cambio de contraseña propio', 'USE_SELF_PASSWORD_CHANGE');
  }
}

export class InvalidCredentialsError extends UsersDomainError {
  constructor() {
    super('Credenciales inválidas', 'INVALID_CREDENTIALS');
  }
}

export class PasswordSameAsCurrentError extends UsersDomainError {
  constructor() {
    super('La nueva contraseña debe ser diferente a la actual', 'PASSWORD_SAME_AS_CURRENT');
  }
}

export class UserHasHistoryError extends UsersDomainError {
  constructor() {
    super('Tiene historial; desactívelo en su lugar', 'USER_HAS_HISTORY');
  }
}

export class LastSuperAdminError extends UsersDomainError {
  constructor() {
    super('Debe existir al menos un Super Admin activo', 'LAST_SUPER_ADMIN');
  }
}

export class ConfirmSelfRoleChangeError extends UsersDomainError {
  constructor() {
    super('CONFIRM_SELF_ROLE_CHANGE', 'CONFIRM_SELF_ROLE_CHANGE');
  }
}

export class MembershipNotFoundError extends UsersDomainError {
  constructor(message = 'Usuario sin membresía') {
    super(message, 'MEMBERSHIP_NOT_FOUND');
  }
}

export class ActorMembershipMissingError extends UsersDomainError {
  constructor() {
    super('Sin membresía', 'ACTOR_MEMBERSHIP_MISSING');
  }
}

export class LockedPermissionsMissingError extends UsersDomainError {
  constructor(
    readonly missing: string[],
  ) {
    super('No se pueden quitar permisos obligatorios del rol', 'LOCKED_PERMISSIONS_MISSING');
  }
}

export class RoleMustHavePermissionsError extends UsersDomainError {
  constructor() {
    super(
      'Un rol debe tener al menos un permiso. Para dejar de usarlo, desactive "Disponible para asignar" en Ajustes.',
      'ROLE_MUST_HAVE_PERMISSIONS',
    );
  }
}

export class DenyLockedPermissionError extends UsersDomainError {
  constructor(readonly permissions: string[]) {
    super('No se pueden denegar permisos obligatorios del rol', 'DENY_LOCKED_PERMISSION');
  }
}

export class InvalidSessionError extends UsersDomainError {
  constructor() {
    super('Sesión inválida', 'INVALID_SESSION');
  }
}

export class AdminRoleAlwaysAssignableError extends UsersDomainError {
  constructor() {
    super('El rol Super Admin siempre está disponible para asignación', 'ADMIN_ROLE_ALWAYS_ASSIGNABLE');
  }
}

export class ConfirmRetainMembersError extends UsersDomainError {
  constructor(readonly memberCount: number) {
    super('CONFIRM_RETAIN_MEMBERS', 'CONFIRM_RETAIN_MEMBERS');
  }
}
