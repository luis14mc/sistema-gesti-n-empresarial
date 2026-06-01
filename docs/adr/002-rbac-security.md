# ADR 002: Arquitectura de Control de Acceso (RBAC)

## Estado
Aceptado y Reforzado (Fase 1 Auditoría 2026)

## Contexto
El sistema maneja datos confidenciales y funciones destructivas. Diferentes empleados tienen diferentes responsabilidades (IT, RRHH, USER regular). Se necesita un sistema para restringir el acceso a rutas y recursos.

## Decisión
Se ha implementado un Control de Acceso Basado en Roles (RBAC) con las siguientes características:
1. **Roles Definidos:** ADMIN, IT, RRHH, USER.
2. **Matriz de Permisos:** Centralizada en `src/lib/permissions.ts`.
3. **Frontend Routing:** Un Middleware de Next.js (`src/middleware.ts`) verifica la validez de la cookie JWT usando la Web Crypto API (HMAC SHA-256) para evitar el acceso a páginas de React no autorizadas.
4. **Backend Enforcing:** Las rutas de la API en `src/app/api/` y los Server Actions utilizan la función `withAuth` o `requireRole` para validar criptográficamente la sesión antes de procesar cualquier transacción o lectura.
5. **Mitigación IDOR:** Las consultas Prisma incluyen forzosamente el `userId` de la sesión para el rol `USER`, evitando que modifiquen IDs en la petición REST.

## Consecuencias
- **Positivas:** Seguridad profunda de múltiples capas (Defensa en Profundidad).
- **Negativas:** Obliga a los desarrolladores a recordar incluir el filtro RBAC en cada nueva ruta API que se cree.
