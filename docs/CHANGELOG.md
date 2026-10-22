# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto adhiere de forma estricta a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-13

### Agregado — Sprint 1 (Estabilizar)
- Módulo completo de **Empleados** (CRUD + integración con asignaciones)
- Endpoints REST estándar `GET/PATCH/DELETE /api/users/[id]`
- Endpoints REST estándar `GET/PATCH/DELETE /api/purchases/[id]`
- Endpoints REST estándar `GET/PATCH/DELETE /api/promotional-items/[id]`
- Endpoints REST estándar `GET/PATCH/DELETE /api/time-entries/[id]`
- **Acciones Correctivas**: implementación completa del CRUD (sustituye stubs 501)
- **StorageAdapter** abstracto con drivers Local (dev) y S3 (producción)
- Prisma migration baseline (`20260713000000_init`)
- **Dockerfile** multi-stage + docker-compose con Postgres + MinIO opcional
- Endpoint `/api/health` (sin auth, para ALB/EC2 health check)
- **34 → 48 → 75 tests unitarios** (Vitest + jsdom + @testing-library/react)

### Agregado — Sprint 2 (Completar funcionalidad)
- Driver **S3StorageAdapter** completo con `getSignedUrl` 15 min, ACL `private`
- Variable `STORAGE_DRIVER` + factory `getStorage()` para alternar dev/prod
- Página **`/settings` real**: editar perfil (4 campos) + cambiar contraseña (8+ chars)
- Endpoints `PATCH /api/auth/me` y `POST /api/auth/password`
- `useAuth().refresh()` para invalidar cache tras update
- **Unificación de auditoría**: `/audit/logs` reemplaza `/audit-records` y `/admin/audit-logs`
- Filtros búsqueda + categoría + módulo en `/audit/logs`
- Dialog con JSON `previousData/newData` y link GPS a Google Maps
- **Oficio.status** `String` → enum `OficioStatus` con migración de datos
- Helper `canAccessRoute()` para una sola fuente de verdad RBAC
- Sidebar `/equipment` y `/oficios` abiertos a USER (solo lectura coherente)

### Agregado — Sprint 3 (Calidad y hardening)
- **CSP nonce dinámico** por request con `strict-dynamic` (sin `unsafe-eval`)
- Cabeceras COOP `same-origin`, COEP `require-corp`
- **Rate limiting** in-memory: 5/min/IP en `/api/auth/login` + headers `X-RateLimit-*`
- **Helper IDOR** reusable: `applyIdorFilter()` + `checkItemAccess()`
- IDOR exhaustivo en `/api/oficios` (list/get/patch/delete): USER solo propios
- `@vitest/coverage-v8` con umbral 60% en CI
- Cobertura alcanzada: **88.77% statements / 92.12% lines**

### Agregado — Sprint 4 (Release AWS)
- **Infraestructura como código** (`infra/terraform/`): VPC, ECR, ECS Fargate, ALB, S3, SSM Parameter Store, IAM
- **Runbook operativo** (`docs/runbook-aws.md`): deploy, rollback, monitoreo, rotación de secretos, incidentes
- **Smoke test script** (`scripts/smoke-test.sh`): health, login, RBAC, rate limit, headers
- Manual de usuario integrado en la propia UI con cards en `/settings`

### Cambiado
- Middleware: usa `routeToAccess()` de `lib/permissions.ts` (sin matriz duplicada)
- Server storage ahora desacoplado (LocalStorageAdapter en dev, S3StorageAdapter en prod)
- `/users` en sidebar conserva `audit-records` como identificador de permiso, URL apunta a `/audit/logs`
- Build pasa de `--turbopack` (default Next 16) a `--webpack` para evitar issues en CI
- `JWT_SECRET` ahora se valida mínimo 32 caracteres (con friendly error)
- `vitest.config.ts` aplica thresholds que bloquean merge si cobertura cae

### Deprecado
- **Módulos frontend eliminados** (formally deprecated):
  - `/tickets` (HelpDesk)
  - `/inventory` (Inv. Promocional)
  - `/time-entries` (Asistencia)
- APIs internas (`/api/tickets/*`, `/api/promotional-items/*`, `/api/time-entries/*`) siguen accesibles para integraciones pero sin UI.
- `DISABLED_ROUTES` del middleware eliminado (no hay rutas ocultas)
- `prisma db push` reemplazado por `prisma migrate deploy` (`prisma:migrate:deploy` script)

### Seguridad
- 🔒 **A01 IDOR**: helper centralizado en `src/lib/idor.ts`, aplicado en endpoints críticos
- 🔒 **A02 Cryptographic Failures**: JWT_SECRET min 32 chars + bcrypt 10 rounds
- 🔒 **A03 Injection**: Prisma typed where + Zod schemas en endpoints
- 🔒 **A05 Security Misconfig**: cabeceras HSTS/XFO/XCTO/Permissions/COOP/COEP
- 🔒 **A07 Auth Failures**: rate limit + delay 500ms + account lockout-ready
- 🔒 **A08 Integrity**: `createAuditRecord` aborta transacción si falla
- 🔒 **CSP nonce**: scripts con `nonce-{random}` y `strict-dynamic`, sin `unsafe-eval`

### Corregido
- StorageAdapter bug: `key` no coincidía con ruta física en disco → ahora ambas correctas
- `prisma/prisma_new.prisma` huérfano eliminado
- `Zone.Identifier` de mockups (metadatos WSL) eliminados
- IDs de users/employees/promocionales ahora parametrizados correctamente en queries
- `Oficio.status` permite solo valores del enum (antes cualquier string)

---

## [0.1.0] - 2026-06-01

### Agregado
- Estructura documental y de gobernanza basada en la norma ISO/IEC/IEEE 12207.
- Documentación inicial de las fases del proyecto (Inicio, Requisitos, Diseño, Desarrollo, Pruebas, Implementación, Mantenimiento).
- Checklist formal de calidad de software (ISO 25010).
- Guía de contribución (`CONTRIBUTING.md`) y política de seguridad (`SECURITY.md`).
- Plantillas para la gestión de incidencias (`bug_report`, `feature_request`, `change_request`).
- Refuerzo de Seguridad Perimetral: CI/CD, Content Security Policy, y rotación de tokens JWT.
- Integración de entorno de pruebas con Vitest y React Testing Library.

### Cambiado
- Consolidación del archivo `README.md` hacia un formato institucional.
- Refactorización de capa API para utilizar tipos estrictos `Prisma.*WhereInput`, mitigando riesgos lógicos.
- Optimización de paginación limitando `pageSize` a 100 registros máximos.

### Corregido
- Vulnerabilidad crítica de Control de Acceso (IDOR) en endpoints de Tickets, Equipos y Asistencia.
- Falla silenciosa en el registro de auditoría (`createAuditRecord`) que comprometía la integridad transaccional.
- Limpieza de código residual y archivos huérfanos (`test-db.js`, scripts VB).
