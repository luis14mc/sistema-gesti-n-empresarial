# ADR 003: Arquitectura oficial — Monolito modular por capas

## Estado
Aceptado — 2026-10-21. **Implementado por completo (fases 0–5).** Reemplaza cualquier convención previa de "poner lógica en `src/lib`".

## Contexto
El SGE es una sola aplicación Next.js 16 (App Router) desplegada en Railway, con Postgres (Prisma 7) y archivos en Cloudflare R2. La arquitectura en capas ya estaba descrita en `docs/architecture/domain-architecture.md` y aplicada en Planilla, Oficios, Bajas de equipo y Reportes, pero:

- Compras vive completo en `src/lib/compras`; Equipos está repartido entre `src/lib/equipment-*` y `src/modules/equipment`.
- 64 rutas API y 2 archivos de servidor importan Prisma directamente (lógica de negocio dentro del handler).
- `src/lib` mezcla utilidades genéricas con reglas de negocio.
- Nada impedía que un PR nuevo siguiera agregando código en cualquier lugar.

MVC clásico no encaja con el App Router (no hay controladores de clase ni vistas server-side separadas). Se formaliza el patrón que ya existe.

## Decisión

### 1. Mapa de carpetas (dónde va cada cosa)

| Carpeta | Responsabilidad | Puede importar |
|---|---|---|
| `src/app/**/page.tsx`, `layout.tsx` | Pantallas (presentación). Solo componen componentes y hooks. | `components`, `hooks`, `services`, `types`, `lib/utils` |
| `src/app/api/**/route.ts` | **Controlador delgado**: autentica (`withAuth`), autoriza (`authorizeOrganization`), valida entrada (zod del módulo), llama **un caso de uso** y traduce errores a HTTP. Sin Prisma ni reglas de negocio. | `modules/*/application`, `modules/*/presentation`, `platform/api`, `platform/security`, `lib/middleware` |
| `src/modules/<módulo>/domain` | Reglas puras: cálculos, transiciones de estado, validaciones de negocio, tipos. Sin I/O. | Solo su propio `domain`, `platform/domain`, librerías puras (`decimal.js`, `zod`). Tipos de `@prisma/client` solo con `import type`. |
| `src/modules/<módulo>/application` | Casos de uso: permisos, orquestación, transacciones (vía *unit of work* de infrastructure), auditoría. Sin `next/*` ni `@/lib/prisma`. | `domain` del módulo, `infrastructure` del módulo, `platform/*`, `application` público de otro módulo |
| `src/modules/<módulo>/infrastructure` | Prisma (repositorios), PDF, Excel, R2, correo. | `domain`, `platform/*`, `@/lib/prisma` |
| `src/modules/<módulo>/presentation` | Esquemas zod de entrada/salida y mapeos a DTO para la API. | `domain` |
| `src/platform/**` | Transversal y sin negocio: seguridad/RBAC, storage, PDF, email, config, observabilidad, jobs. | `platform/*`, `@/lib/prisma` |
| `src/components/**` | UI reutilizable (React). Sin acceso a servidor. | `hooks`, `services`, `types`, `components/ui`, `lib/utils` |
| `src/hooks/**`, `src/services/**` | Cliente HTTP del front (React Query + axios). **Una sola forma** de llamar a la API: `services/<módulo>.service.ts` + `hooks/use<Módulo>.ts`. | `services`, `types` |
| `src/lib/**` | **Congelado.** Solo utilidades genéricas: `utils`, `prisma`, `swal`, `brand`, `form-errors`, `api-error-message`, `zod-schemas`, `organization-page-context`. No se agregan archivos nuevos. | — |

Flujo de una petición:

```
page.tsx → hook → service (HTTP) → route.ts → application (caso de uso) → domain (reglas)
                                                       ↘ infrastructure (Prisma / R2 / PDF / SMTP)
```

### 2. Reglas obligatorias (verificadas en CI)

1. **Prisma solo en `src/modules/*/infrastructure/**` y `src/platform/**`.** Prohibido importar `@/lib/prisma` en cualquier otro archivo de `src/` (test de arquitectura). En presentación (`src/app`, `src/components`, `src/hooks`, `src/services`, `src/stores`, `src/providers`, `src/actions`, `src/utils`, `src/types`, `src/modules/*/presentation`) tampoco se importan valores de `@prisma/client`; `import type` sí está permitido (ESLint `@typescript-eslint/no-restricted-imports`).
2. **`application` no importa `next`, `next/*` ni `@/lib/prisma`** (ESLint).
3. **`domain` es puro:** no importa `next`, `react`, `@/lib/prisma`, ni `application`/`infrastructure` de ningún módulo.
4. **`src/lib` congelado:** un test de arquitectura falla si aparece un archivo nuevo en `src/lib`.
5. **Sin excepciones:** las listas de `eslint.architecture-baseline.mjs` están vacías y un test falla si se agrega cualquier entrada; `eslint.config.mjs` no desactiva reglas por archivo.
6. Un módulo no importa la `infrastructure` de otro módulo; usa su `application`.
7. RBAC (ADR 002) no cambia: autorización por permiso efectivo en `application`/route, nunca por nombre de rol en UI.

### 3. Plan de migración (sin romper código)
Cada fase fue un PR independiente, con las pruebas existentes en verde y sin cambios de comportamiento ni de base de datos. **Todas las fases están completas.**

| Fase | Alcance | Criterio de salida | Estado |
|---|---|---|---|
| 0 | Este ADR, reglas ESLint, test de arquitectura, lista de excepciones, limpieza de archivos muertos | CI en verde; la lista de excepciones existe | Completa |
| 1 | Equipos: `lib/equipment-*` → `modules/equipment/{domain,application,infrastructure}`; rutas `api/equipment*` delgadas | Sin entradas de equipos en la lista de excepciones | Completa |
| 2 | Usuarios, roles y permisos (núcleo RBAC: con pruebas antes y después; unificar `lib/permissions.ts` y `platform/security/route-access.ts`) | Un solo mapa de rutas→módulo | Completa |
| 3 | Oficios y correspondencia (resto de `lib/oficios-*`) | — | Completa |
| 4 | Compras (`lib/compras/**` → `modules/purchases`) | — | Completa |
| 5 | Resto de rutas (auth, people, audits, disposal, organizations, notifications, reporting, software-licenses, dashboard) y `src/lib` reducido a utilidades genéricas | Listas de excepciones vacías; reglas como `error` sin excepciones | Completa |

Planilla (`src/modules/payroll`) es el módulo de referencia: copiar su estructura.

### 4. Mapa final de módulos

| Módulo | Ubicación | Contenido principal |
|---|---|---|
| Auditorías | `src/modules/audits` | Auditorías y acciones correctivas |
| Autenticación | `src/modules/auth` | Login (API y sesión), registro, repositorio de credenciales |
| Dashboard | `src/modules/dashboard` | KPIs de la pantalla principal |
| Equipos | `src/modules/equipment` | Inventario, asignaciones, mantenimiento, importación/exportación Excel |
| Bajas de equipo | `src/modules/equipment-disposal` | Flujo de baja, documentos |
| Notificaciones | `src/modules/notifications` | Notificaciones y eventos de seguridad |
| Oficios | `src/modules/oficios` | Correspondencia, numeración, importación histórica |
| Organizaciones | `src/modules/organizations` | Contexto de organización, ciclo de vida, membresías |
| Planilla | `src/modules/payroll` | Boletas, ajustes, ISR/IHSS, envío SMTP |
| Personas | `src/modules/people` | Empleados y departamentos |
| Compras | `src/modules/purchases` | Órdenes de compra, proveedores, reportes |
| Reportes | `src/modules/reporting` | Exportaciones de reportes (Excel/PDF) |
| Licencias de software | `src/modules/software-licenses` | Suscripciones, asientos, renovaciones, importación |
| Usuarios | `src/modules/users` | Usuarios, roles, permisos efectivos |
| Plataforma | `src/platform` | Seguridad/RBAC, API, storage, PDF, Excel, email, integraciones, jobs, observabilidad |

## Consecuencias
- **Positivas:** el desorden deja de crecer desde el primer PR; cada módulo se puede leer de forma aislada; Cursor/agentes tienen reglas verificables; las pruebas de dominio no necesitan base de datos.
- **Negativas:** mover archivos generó diffs grandes (sin cambios de lógica); algunos repositorios de infrastructure son delegados finos sobre Prisma (por ejemplo `payroll/infrastructure/payroll-records.ts`) que pueden refinarse a métodos por intención cuando se toque el código.
