# Estado Actual de Autorización RBAC

## Alcance

Este documento registra el estado de autorización de SGE antes de Phase 16A.
No define todavía la matriz final ni cambia el comportamiento de autorización.

## Resumen

Actualmente coexisten dos implementaciones activas:

| Implementación | Fuente de rol | Fuente de permisos | Consumidores | Clasificación |
|---|---|---|---|---|
| RBAC histórico | `User.role` (`ADMIN`, `USER`, `RRHH`, `IT`) | `src/lib/permissions.ts` | APIs antiguas, middleware frontend, sesión, navegación y UI | `LEGACY` |
| RBAC organizacional | `OrganizationMembership.role` (`OrganizationRole`) | `src/platform/security/authorization/permissions.ts` | Equipment disposal, reporting, notifications, integrations y plataforma | `CANONICAL_TARGET` |

La autenticación JWT compartida en `src/lib/middleware.ts` es un adaptador de compatibilidad: valida identidad y opcionalmente compara roles históricos, pero no resuelve permisos granulares ni el contexto organizacional.

## Modelos Prisma

### Identidad y membresía

| Modelo/campo | Ubicación | Estado |
|---|---|---|
| `User.role` | `prisma/schema.prisma:131` | Rol global histórico; no debe ser fuente final de autorización organizacional |
| `User.platformRole` | `prisma/schema.prisma:132` | Rol exclusivo de plataforma |
| `User.organizationMemberships` | `prisma/schema.prisma:167` | Relación organizacional |
| `OrganizationMembership.role` | `prisma/schema.prisma:65` | Mejor candidato para rol organizacional canónico |
| `OrganizationMembership.status` | `prisma/schema.prisma:66` | Requerido para que la membresía sea válida |

### Enums actuales

```text
Role:
  ADMIN, USER, RRHH, IT

OrganizationRole:
  OWNER, ADMIN, IT_MANAGER, IT_TECHNICIAN, PROCUREMENT, HR, AUDITOR, USER

PlatformRole:
  PLATFORM_ADMIN, SUPPORT_ADMIN
```

Los roles institucionales solicitados por Phase 16A aún no existen como `OrganizationRole`:

```text
ADMINISTRACION
SECRETARIA
DIRECTOR
```

No se debe mapear estos roles silenciosamente a `PROCUREMENT`, `HR` o `USER` sin revisión funcional.

### Permisos persistidos

No existen actualmente modelos Prisma para:

```text
Permission
RolePermission
UserPermissionOverride
```

La matriz moderna está definida únicamente en código. Por tanto, la administración de permisos desde la aplicación todavía no es posible.

### Auditoría

| Modelo | Propósito | Estado |
|---|---|---|
| `AuditRecord` | Auditoría funcional histórica | Compatibilidad; no es el log de seguridad único |
| `SystemAuditEvent` | Eventos de seguridad append-only | Objetivo para cambios de autorización y denegaciones |
| `Audit` | Auditoría institucional | Dominio independiente, no sustituye RBAC audit |

## Implementaciones

### Histórico: `src/lib/permissions.ts`

Contiene:

- `PERMISSIONS`: matriz `Role → Module → Action`.
- `canAccess(role, module, action)`.
- `hasModuleAccess(role, module)`.
- `ROUTE_ACCESS_BY_MODULE`.
- `routeToAccess(pathname)`.
- `canAccessRoute(role, pathname)`.

Consumidores productivos encontrados:

- APIs de Oficios, Compras, Equipos y uploads.
- `src/lib/middleware.ts` para rutas frontend.
- `MainLayout.tsx` y componentes de navegación.
- Páginas de auditorías, empleados, equipos, asignaciones y Oficios.
- `requireRole()` en `src/lib/session.ts` y `registerAction`.

Clasificación: `LEGACY`, pero todavía participa en decisiones reales.

### Objetivo moderno: `src/platform/security/authorization/permissions.ts`

Contiene:

- Catálogo de permisos organizacionales y de plataforma.
- Matriz `OrganizationRole → Permission`.
- Matriz `PlatformRole → Permission`.
- `can(scopedRole, permission)`.
- `requirePermission(context, permission)`.

Consumidores productivos encontrados:

- `equipment-disposal`.
- reporting.
- notifications.
- integrations.
- administración de plataforma.

Clasificación: `CANONICAL_TARGET`, pendiente de ampliar con roles institucionales, overrides persistidos y migración de consumidores históricos.

### Contexto organizacional

`src/modules/organizations/application/context.ts`:

- valida usuario activo;
- valida membresía activa;
- valida organización seleccionada;
- devuelve `organizationId` y `OrganizationRole`.

Clasificación: `CANONICAL_TARGET`.

Esto es aislamiento multi-tenant, no reemplaza una comprobación de permiso de negocio.

### Autenticación compartida

`src/lib/middleware.ts` / `withAuth()`:

- valida JWT;
- permite `Authorization` o cookie;
- aplica `allowedRoles` históricos cuando se proporciona;
- no resuelve `OrganizationMembership.role`;
- no resuelve permisos efectivos.

Clasificación de autenticación: `COMPATIBILITY_ONLY` para APIs históricas. La autorización que contiene por `allowedRoles` es `LEGACY`.

## UI y navegación

`src/components/layout/MainLayout.tsx` y `src/components/layout/nav-items.ts` usan `hasModuleAccess(User.role, module)`.

Clasificación: `LEGACY`.

La UI actual no usa permisos efectivos derivados de membresía ni overrides. Ocultar una navegación o botón no es enforcement de seguridad; las APIs deben ser la autoridad.

## API: patrones observados

### Patrón histórico

```ts
export const POST = withAuth(handler, ['ADMIN', 'IT']);
```

o:

```ts
withAuth(handler);
// dentro:
canAccess(role, 'module', 'action');
```

Clasificación: `LEGACY`.

### Patrón objetivo

```ts
const context = await requireOrganizationContext(req, requestId);
requirePermission(context, 'equipment-disposal.approve');
```

Clasificación: `CANONICAL_TARGET`.

## Discrepancias relevantes

1. `User.role` y `OrganizationMembership.role` pueden representar roles distintos para el mismo usuario.
2. `Role` tiene 4 valores; `OrganizationRole` tiene 8 valores y diferente semántica.
3. Las APIs históricas autorizan con JWT `role`, no con el rol de la membresía activa.
4. La navegación usa la matriz histórica.
5. No hay `Permission` persistido.
6. No hay `UserPermissionOverride` persistido.
7. No hay UI para administrar permisos efectivos.
8. `ADMIN` moderno recibe la matriz de permisos en código, mientras `ADMIN` histórico recibe otra matriz distinta.
9. Hay rutas con `withAuth()` sin permiso de negocio explícito; deben migrarse o clasificarse como lecturas públicas para cualquier rol autenticado.
10. La regla de baja de Oficios aún no está representada como `oficios.deactivate`; el DELETE histórico requiere revisión de dominio.

## Clasificación de componentes

| Componente | Clasificación | Acción Phase 16A |
|---|---|---|
| `src/platform/security/authorization/permissions.ts` | `CANONICAL_TARGET` | Extender o convertir en resolver efectivo único |
| `src/modules/organizations/application/context.ts` | `CANONICAL_TARGET` | Mantener como contexto obligatorio |
| `src/modules/organizations/application/platform-context.ts` | `CANONICAL_TARGET` | Mantener separado para plataforma |
| `src/lib/permissions.ts` | `LEGACY` | Migrar consumidores y retirar al final |
| `src/lib/middleware.ts` | `COMPATIBILITY_ONLY` | Mantener autenticación; retirar autorización histórica |
| `src/middleware.ts` | `LEGACY` | Mantener protección coarse; migrar roles a permisos efectivos |
| `src/lib/session.ts` | `LEGACY` | Migrar `requireRole` a permiso/contexto |
| `MainLayout.tsx` | `LEGACY` | Usar permisos efectivos |
| `nav-items.ts` | `LEGACY` | Mantener catálogo de UI, cambiar filtro a `can(permission)` |
| `AuditRecord` | `COMPATIBILITY_ONLY` | No usar como único log de seguridad |
| `SystemAuditEvent` | `CANONICAL_TARGET` | Auditar cambios y denegaciones RBAC |
| `/api/platform/**` | `CANONICAL_TARGET` | Mantener como ámbito plataforma |
| `/api/equipment-disposal/**` | `CANONICAL_TARGET` | Migrar a resolver efectivo común |

## Decisión objetivo propuesta

La Phase 16A debe seleccionar:

```text
OrganizationMembership.role = único rol organizacional
User.platformRole = único rol de plataforma
Permission registry = catálogo único
Role defaults = defaults del rol organizacional
UserPermissionOverride = excepciones ALLOW/DENY por usuario y organización
Effective permission resolver = única autoridad
```

`User.role` quedará temporalmente como compatibilidad de migración, sin participar en decisiones nuevas. Se eliminará únicamente cuando no tenga consumidores productivos.

## Bloqueadores antes de migrar

1. Aprobar nombres y semántica de `ADMINISTRACION`, `SECRETARIA` y `DIRECTOR` en `OrganizationRole`.
2. Confirmar si los permisos configurables son por usuario y organización, no globales.
3. Confirmar el baseline exacto de `ADMINISTRACION`, especialmente `equipment-disposal.approve`.
4. Confirmar si se requiere `oficios.restore` en esta fase.
5. Definir migración de usuarios existentes sin ampliar privilegios inesperadamente.
6. Auditar y clasificar cada ruta antes de retirar `lib/permissions.ts`.
