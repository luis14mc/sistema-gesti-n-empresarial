# Sistema de Gestión Empresarial (SGE)

## Descripción General

El **Sistema de Gestión Empresarial (SGE)** es una plataforma integral diseñada para centralizar, controlar y auditar los procesos operativos corporativos. Provee módulos especializados para la administración de personal, control de inventarios, asignación de equipos informáticos, sistema de tickets (HelpDesk), trazabilidad documental (Oficios), **órdenes de compra institucionales (CNI)**, compras legacy y auditoría interna.

Este proyecto sigue metodologías formales de ciclo de vida de desarrollo de software (SDLC) inspiradas en la normativa **ISO/IEC/IEEE 12207** y cuenta con controles de calidad bajo la norma **ISO/IEC 25010**.

## Módulos del Sistema

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Dashboard | `/dashboard` | Panel principal con métricas operativas |
| Tickets | `/tickets` | HelpDesk y seguimiento de incidencias |
| Oficios | `/oficios` | Gestión de correspondencia y oficios |
| Equipos | `/equipment` | Inventario de activos informáticos |
| Dictámenes de baja | `/equipment-disposal` | Diagnóstico, evaluación y aprobación de bajas de equipo |
| Inv. Promocional | `/inventory` | Control de artículos promocionales |
| Compras (legacy) | `/purchases` | Registro y seguimiento de adquisiciones |
| **Órdenes de Compra CNI** | `/compras` | Órdenes institucionales, plantilla, adjuntos y PDF |
| Asistencia | `/time-entries` | Control de entradas y salidas |
| Asignaciones | `/assignments` | Asignación y devolución de equipos |
| Auditoría | `/audit-records` | Registros y trazabilidad de auditoría |
| Usuarios | `/users` | Administración de cuentas y roles |
| Ajustes | `/settings` | Configuración del sistema |

## Stack Tecnológico

- **Frontend / Framework:** Next.js 16 (App Router) / React 19
- **Lenguaje:** TypeScript 5
- **UI:** shadcn/ui, Tailwind CSS v4, Lucide Icons
- **Notificaciones:** Sileo (toasts), SweetAlert2 (diálogos)
- **Tipografía:** Montserrat
- **Gestor de Estado:** Zustand, TanStack React Query
- **Formularios:** React Hook Form + Zod
- **Backend / ORM:** Prisma ORM 7
- **Base de Datos:** PostgreSQL (Neon.tech)
- **Seguridad:** JWT, bcryptjs, RBAC dinámico (middleware + API + UI)
- **Almacenamiento:** adaptador local (dev) / S3 (prod) para adjuntos y PDF
- **PDF:** Puppeteer (HTML → PDF) con plantilla configurable

## Interfaz y Diseño

La interfaz utiliza una paleta institucional con soporte **Dark/Light mode** persistente:

| Color | Hex | Uso |
|-------|-----|-----|
| Verde institucional | `#25A966` | Acciones primarias, éxito |
| Azul institucional | `#35A8E0` | Acentos, enlaces |
| Azul marino | `#252A58` | Sidebar, encabezados |

Componentes base reutilizables: `PageHeader`, `StatsCard`, `Pagination`, `ThemeToggle`, `BrandLogo`.

### Marca institucional (CNI Honduras)

Logo oficial en `public/Logo_CNI.png` (PNG con fondo transparente). Se utiliza en:

- Favicon y apple touch icon (`src/app/icon.tsx`, `src/app/apple-icon.tsx`)
- Login, sidebar y menú móvil (`BrandLogo`)
- Plantilla de orden de compra e institución (`INSTITUTION_LOGO_PATH`)

Constantes compartidas: `src/lib/brand.ts`.

## Control de Acceso (RBAC)

El acceso se controla por rol en tres capas: middleware, rutas API y componentes de UI.

| Rol | Alcance principal |
|-----|-------------------|
| `ADMIN` | Acceso completo a todos los módulos |
| `IT` | Tickets, equipos, asignaciones, compras |
| `RRHH` | Usuarios, oficios, asistencia, inventario |
| `USER` | Dashboard, tickets propios, asistencia, consulta de equipos |

La matriz de permisos se define en `src/lib/permissions.ts`. El submódulo de órdenes de compra tiene permisos adicionales en `src/lib/compras/orden/permissions.ts`.

## Módulo de Órdenes de Compra (CNI)

Flujo institucional de órdenes de compra para el Consejo Nacional de Inversiones. Modelos Prisma: `CompraOrden`, `CompraOrdenItem`, `CompraOrdenDocumento`, `CompraOrdenTemplate` (tablas `purchase_orders*`).

### Rutas de la aplicación

| Ruta | Descripción |
|------|-------------|
| `/compras/solicitudes` | Historial con columna de adjuntos y acciones por fila |
| `/compras/nueva` | Creación de borrador (pestañas Datos / Vista previa / Adjuntos) |
| `/compras/[id]` | Detalle: borrador editable o orden generada |
| `/compras/[id]/imprimir` | Vista de impresión |
| `/settings/compras/template` | Configuración de plantilla activa (solo ADMIN) |

### Ciclo de vida

```text
DRAFT → GENERATED → ISSUED → CLOSED
                  ↘ CANCELLED
```

| Estado | Descripción |
|--------|-------------|
| `DRAFT` | Borrador editable; vista previa con plantilla activa |
| `GENERATED` | Número asignado, PDF generado, snapshot de plantilla congelado |
| `ISSUED` | Orden emitida oficialmente |
| `CLOSED` | Orden cerrada |
| `CANCELLED` | Anulada (requiere motivo) |

Al **generar** una orden se guardan `templateId`, `templateVersion` y `templateSnapshot` (JSON inmutable). Las órdenes históricas y la regeneración de PDF usan el snapshot, no la plantilla activa actual.

### Interfaz de borrador

Pantallas `/compras/nueva` y `/compras/[id]` (estado `DRAFT`) usan `CompraOrdenDraftWorkspace`:

**Acciones visibles:** `Guardar cambios` · `Generar orden` (solo si ya existe ID) · enlace `Volver`.

**Pestañas:**

1. **Datos** — Formulario `CompraOrdenForm` (validación reactiva, totales en tiempo real).
2. **Vista previa** — `PurchaseOrderPreview`: HTML en vivo desde valores del formulario + plantilla activa (debounce ~400 ms, sin botón de preview).
3. **Adjuntos** — Subida drag-and-drop; filas clicables; menú ⋮ con Descargar / Eliminar.

Al guardar un borrador nuevo, los archivos pendientes se suben secuencialmente; los fallos parciales se reportan sin perder la orden creada.

### Interfaz de orden generada

`CompraOrdenGeneratedDetail` muestra:

- Vista previa embebida de la orden (desde snapshot o API `/pdf`).
- Documentos adjuntos debajo.
- Un botón primario: **Descargar PDF**.
- Menú ⋮ para acciones secundarias (Emitir, Regenerar PDF, Cerrar, Anular).

### Documentos adjuntos

| Momento | Comportamiento |
|---------|----------------|
| Antes de guardar | Estado local `PendingPurchaseDocument`; preview con `URL.createObjectURL` |
| Tras guardar | `POST /api/compras/ordenes/[id]/documentos` |
| Visualización | `PurchaseDocumentViewerDialog` — iframe solo con URL válida |
| Archivos en servidor | `GET .../documentos/[documentId]/view` devuelve bytes con `Content-Disposition: inline` |

**Tipos permitidos:** PDF, JPG, JPEG, PNG · máximo 10 MB · validación MIME, extensión y duplicados.

**Visor:** nunca renderiza `<iframe src="">`. Archivos locales usan blob URL; archivos guardados usan el endpoint `/view` (no URLs firmadas almacenadas en BD).

### Plantilla y vista previa

- **Plantilla activa:** `GET /api/compras/configuracion/plantilla-activa`
- **Preview de borrador:** `POST /api/compras/ordenes/preview` (no persiste, no asigna correlativo)
- **Preview de orden guardada:** `GET /api/compras/ordenes/[id]/pdf` (HTML)
- **Renderer compartido:** `buildPurchaseOrderHtml` en `src/lib/compras/orden/pdf.ts` + plantilla `src/templates/compras/purchase-order.html`

Campos configurables: logo, nombre institucional, colores, título, prefijo, pie, firma, visibilidad de campos institucionales. Marca de agua `BORRADOR` cuando no hay número de orden.

### API REST — Órdenes de compra

```text
GET    /api/compras/ordenes
POST   /api/compras/ordenes
GET    /api/compras/ordenes/[id]
PATCH  /api/compras/ordenes/[id]
POST   /api/compras/ordenes/[id]/generar
POST   /api/compras/ordenes/[id]/emitir
POST   /api/compras/ordenes/[id]/cerrar
POST   /api/compras/ordenes/[id]/anular
POST   /api/compras/ordenes/[id]/regenerar-pdf
GET    /api/compras/ordenes/[id]/pdf
GET    /api/compras/ordenes/[id]/historial
POST   /api/compras/ordenes/preview
GET    /api/compras/configuracion/plantilla-activa
GET    /api/compras/template          PUT (ADMIN)
GET    /api/compras/ordenes/[id]/documentos
POST   /api/compras/ordenes/[id]/documentos
GET    /api/compras/ordenes/[id]/documentos/[documentId]/view
GET    /api/compras/ordenes/[id]/documentos/[documentId]/download
DELETE /api/compras/ordenes/[id]/documentos/[documentId]
```

### Componentes y capa de servicio (referencia)

```text
src/components/compras/
  CompraOrdenDraftWorkspace.tsx    # Borrador: pestañas + acciones
  CompraOrdenGeneratedDetail.tsx   # Orden generada/emitida
  CompraOrdenForm.tsx              # Formulario institucional
  PurchaseOrderPreview.tsx         # Vista previa HTML en vivo
  PurchaseDocumentViewerDialog.tsx # Modal visor PDF/imagen
  PurchaseOrderAttachmentRows.tsx  # Lista de adjuntos (fila + menú ⋮)
  CompraOrdenHistory.tsx           # Historial de la orden

src/lib/compras/orden/
  service.ts          # CRUD, workflow, adjuntos, PDF
  pdf.ts              # HTML compartido (preview + PDF)
  template-config.ts  # DTO de plantilla y snapshot
  document-access.ts  # Lectura/borrado en storage
  serialize.ts        # API: documentos, documentsCount en listado

src/hooks/useCompraOrden.ts        # React Query + invalidación de caché
src/services/compra-orden.service.ts
```

Tras editar plantilla, subir o eliminar documentos: se invalidan cachés de plantilla activa, detalle, listado e historial.

### Almacenamiento de archivos

Configuración en `.env` (ver `.env.example`):

```env
STORAGE_DRIVER="local"          # local | s3
LOCAL_STORAGE_PATH="./public/uploads"
# Producción S3: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET
```

Claves bajo `compras/ordenes/{orderId}/documentos/` y `.../pdf/`. El endpoint `/view` lee bytes del adaptador (`StorageAdapter.get()`), no reutiliza URLs expiradas guardadas en la base de datos.

### Cambios recientes en este módulo

- Adjuntos visibles en creación, historial (`documentsCount`) y detalle.
- Visor web corregido: sin `iframe` con `src` vacío; endpoint `/view` sirve bytes inline (compatible con CSP).
- Preview en vivo en pestaña dedicada; plantilla activa vía API (sin valores hardcodeados en UI).
- Snapshot de plantilla al generar; PDF histórico inmutable ante cambios de configuración.
- Formulario con validación `onChange`, mensajes de error en español y totales reactivos.
- Listado ligero sin cargar todos los documentos por fila.
- Invalidación de caché React Query tras plantilla, upload y delete.

## Estructura del Proyecto

```text
/
├── .github/              # Plantillas de incidencias y CI/CD (GitHub Actions)
├── docs/                 # Documentación formal del Ciclo de Vida (ISO 12207)
├── mockups/              # Referencias visuales de diseño
├── prisma/               # Esquema de base de datos, migraciones y seed
├── src/
│   ├── app/
│   │   ├── compras/      # UI órdenes de compra CNI
│   │   └── api/compras/  # API REST compras y órdenes
│   ├── components/
│   │   └── compras/      # Formulario, preview, adjuntos, visor
│   ├── hooks/            # useCompraOrden, plantilla activa
│   ├── lib/
│   │   ├── compras/orden/  # Servicio, PDF, plantilla, storage
│   │   └── storage/        # Adaptadores local / S3
│   ├── services/         # compra-orden.service.ts
│   ├── templates/compras/  # Plantilla HTML purchase-order.html
│   └── types/            # compra-orden, documentos pendientes
```

## Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/luis14mc/sistema-gesti-n-empresarial.git
cd sistema-gestion-empresarial
```

### 2. Configurar variables de entorno

Copiar el archivo de plantilla y completar las credenciales:

```bash
cp .env.example .env
```

Variables requeridas:

```env
DATABASE_URL="postgresql://USUARIO:PASSWORD@HOST:5432/DATABASE?sslmode=require"
DIRECT_URL="postgresql://..."   # Conexión directa para migraciones (Neon)
JWT_SECRET="clave-segura-de-al-menos-32-caracteres"
STORAGE_DRIVER="local"
```

Consulte `.env.example` para storage S3, `APP_URL` y demás opciones.

> **Atención:** `JWT_SECRET` debe ser una clave criptográfica segura y distinta en producción. Nunca exponga variables de servidor con el prefijo `NEXT_PUBLIC_`.

### 3. Instalar dependencias

El proyecto usa **pnpm** (lockfile incluido):

```bash
pnpm install --frozen-lockfile
```

pnpm es el único gestor soportado. La versión revisada está fijada en `packageManager`.

### 4. Inicializar base de datos

Aplicar migraciones y poblar datos iniciales:

```bash
pnpm prisma migrate deploy   # Producción / Neon
pnpm prisma generate
pnpm prisma:seed
```

Los cambios de esquema se realizan exclusivamente mediante migraciones revisadas. No use `prisma db push` como sustituto.

## Ejecución

**Modo desarrollo:**

```bash
pnpm dev
```

**Compilación y producción:**

```bash
pnpm build
pnpm start
```

**Validación completa (recomendada antes de desplegar):**

```bash
pnpm prisma validate
pnpm prisma generate
pnpm typecheck
pnpm test
pnpm build
```

**Otros comandos útiles:**

```bash
pnpm lint                 # Análisis estático ESLint
pnpm prisma:studio        # Explorador visual de la base de datos
pnpm compras:repair-drafts  # Reparación de borradores (script utilitario)
pnpm organizations:backfill # Backfill idempotente de la organización CNI
```

## Arquitectura SaaS

La evolución multi-tenant usa un monolito modular con `Organization` y membresías por usuario. El módulo de dictámenes de baja nace aislado por organización; los módulos legacy se migran por etapas para no interrumpir la instalación CNI existente.

Antes de habilitar el módulo en una base existente:

```bash
pnpm prisma migrate deploy
pnpm organizations:backfill
```

Consulte [`docs/architecture/saas-architecture.md`](./docs/architecture/saas-architecture.md), [`docs/architecture/tenant-isolation.md`](./docs/architecture/tenant-isolation.md) y [`docs/database/migration-plan.md`](./docs/database/migration-plan.md).

## Pruebas

El proyecto incluye pruebas unitarias para utilidades críticas (autenticación, permisos, cálculos de órdenes de compra):

```bash
pnpm test                 # Ejecutar pruebas una vez
pnpm test:watch           # Modo observador
pnpm test:coverage        # Cobertura
```

## Documentación Disponible

Toda la documentación arquitectónica, técnica y operativa se encuentra en el directorio [`/docs`](./docs):

- **Diseño y Arquitectura:** [`/docs/03-diseno/`](./docs/03-diseno/)
- **Guías de Despliegue:** [`/docs/06-implementacion/`](./docs/06-implementacion/)
- **Gestión de Calidad:** [`/docs/checklist-calidad-software.md`](./docs/checklist-calidad-software.md)
- **ADRs (Registros de Decisión):** [`/docs/adr/`](./docs/adr/)
- **Plan de Refactorización UI:** [`implementation_plan.md`](./implementation_plan.md)

## Control de Versiones y Contribución

Este proyecto utiliza **Git Flow** simplificado. Para contribuir, revise la [Guía de Contribución](CONTRIBUTING.md) y consulte el registro de cambios en [CHANGELOG.md](CHANGELOG.md).

- **Ramas principales:** `main` (producción), `develop` (desarrollo integrado).

## Licencia

Propiedad corporativa privada. Prohibida su distribución.
