# ADR 003: Arquitectura oficial — Monolito modular por capas

## Estado
Aceptado — 2026-10-21. Reemplaza cualquier convención previa de "poner lógica en `src/lib`".

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
| `src/modules/<módulo>/application` | Casos de uso: permisos, orquestación, transacciones, auditoría. | `domain` del módulo, `infrastructure` del módulo, `platform/*`, `application` público de otro módulo |
| `src/modules/<módulo>/infrastructure` | Prisma (repositorios), PDF, Excel, R2, correo. | `domain`, `platform/*`, `@/lib/prisma` |
| `src/modules/<módulo>/presentation` | Esquemas zod de entrada/salida y mapeos a DTO para la API. | `domain` |
| `src/platform/**` | Transversal y sin negocio: seguridad/RBAC, storage, PDF, email, config, observabilidad, jobs. | `platform/*`, `@/lib/prisma` |
| `src/components/**` | UI reutilizable (React). Sin acceso a servidor. | `hooks`, `services`, `types`, `components/ui`, `lib/utils` |
| `src/hooks/**`, `src/services/**` | Cliente HTTP del front (React Query + axios). **Una sola forma** de llamar a la API: `services/<módulo>.service.ts` + `hooks/use<Módulo>.ts`. | `services`, `types` |
| `src/lib/**` | **Congelado (legado).** No se agregan archivos nuevos. Se vacía módulo por módulo hacia `modules/` o `platform/`. | — |

Flujo de una petición:

```
page.tsx → hook → service (HTTP) → route.ts → application (caso de uso) → domain (reglas)
                                                       ↘ infrastructure (Prisma / R2 / PDF / SMTP)
```

### 2. Reglas obligatorias (verificadas en CI)

1. **Prisma solo en `infrastructure`, `application` (transitorio) y `platform`.** Prohibido importar `@/lib/prisma` o valores de `@prisma/client` en `src/app`, `src/components`, `src/hooks`, `src/services`, `src/stores`, `src/providers`, `src/actions`, `src/utils` y `src/types` (ESLint `@typescript-eslint/no-restricted-imports`). `import type` sí está permitido.
2. **`domain` es puro:** no importa `next`, `react`, `@/lib/prisma`, ni `application`/`infrastructure` de ningún módulo.
3. **`src/lib` congelado:** un test de arquitectura falla si aparece un archivo nuevo en `src/lib`.
4. **Lista de excepciones congelada:** los archivos que hoy violan la regla 1 están en `eslint.architecture-baseline.mjs`. La lista **solo puede reducirse**; un test falla si se agrega una entrada o si una entrada ya no existe (hay que quitarla al migrar).
5. Un módulo no importa la `infrastructure` de otro módulo; usa su `application`.
6. RBAC (ADR 002) no cambia: autorización por permiso efectivo en `application`/route, nunca por nombre de rol en UI.

### 3. Plan de migración (sin romper código)
Cada fase es un PR independiente, con las pruebas existentes en verde y sin cambios de comportamiento ni de base de datos.

| Fase | Alcance | Criterio de salida |
|---|---|---|
| 0 | Este ADR, reglas ESLint, test de arquitectura, lista de excepciones, limpieza de archivos muertos | CI en verde; la lista de excepciones existe |
| 1 | Equipos: `lib/equipment-*` → `modules/equipment/{domain,application,infrastructure}`; rutas `api/equipment*` delgadas | Sin entradas de equipos en la lista de excepciones |
| 2 | Usuarios, roles y permisos (núcleo RBAC: con pruebas antes y después; unificar `lib/permissions.ts` y `platform/security/route-access.ts`) | Un solo mapa de rutas→módulo |
| 3 | Oficios y correspondencia (resto de `lib/oficios-*`) | — |
| 4 | Compras (`lib/compras/**` → `modules/purchases`) | — |
| 5 | Resto de rutas y `src/lib` reducido a utilidades genéricas (`utils`, `prisma`, `middleware`) | Lista de excepciones vacía; reglas como `error` sin excepciones |

Planilla (`src/modules/payroll`) es el módulo de referencia: copiar su estructura.

## Consecuencias
- **Positivas:** el desorden deja de crecer desde el primer PR; cada módulo se puede leer de forma aislada; Cursor/agentes tienen reglas verificables; las pruebas de dominio no necesitan base de datos.
- **Negativas:** durante la migración convivirán ambos estilos; mover archivos genera diffs grandes (se hacen sin cambios de lógica, "mover y re-exportar"); `application` sigue usando Prisma directamente hasta que se extraigan repositorios (aceptado como transitorio).
