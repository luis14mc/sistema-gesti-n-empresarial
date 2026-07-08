# Sistema de Gestión Empresarial (SGE)

## Descripción General

El **Sistema de Gestión Empresarial (SGE)** es una plataforma integral diseñada para centralizar, controlar y auditar los procesos operativos corporativos. Provee módulos especializados para la administración de personal, control de inventarios, asignación de equipos informáticos, sistema de tickets (HelpDesk), trazabilidad documental (Oficios), compras y auditoría interna.

Este proyecto sigue metodologías formales de ciclo de vida de desarrollo de software (SDLC) inspiradas en la normativa **ISO/IEC/IEEE 12207** y cuenta con controles de calidad bajo la norma **ISO/IEC 25010**.

## Módulos del Sistema

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Dashboard | `/dashboard` | Panel principal con métricas operativas |
| Tickets | `/tickets` | HelpDesk y seguimiento de incidencias |
| Oficios | `/oficios` | Gestión de correspondencia y oficios |
| Equipos | `/equipment` | Inventario de activos informáticos |
| Inv. Promocional | `/inventory` | Control de artículos promocionales |
| Compras | `/purchases` | Registro y seguimiento de adquisiciones |
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
- **Pruebas Automatizadas:** Vitest, React Testing Library

## Interfaz y Diseño

La interfaz utiliza una paleta institucional con soporte **Dark/Light mode** persistente:

| Color | Hex | Uso |
|-------|-----|-----|
| Verde institucional | `#25A966` | Acciones primarias, éxito |
| Azul institucional | `#35A8E0` | Acentos, enlaces |
| Azul marino | `#252A58` | Sidebar, encabezados |

Componentes base reutilizables: `PageHeader`, `StatsCard`, `Pagination`, `ThemeToggle`.

## Control de Acceso (RBAC)

El acceso se controla por rol en tres capas: middleware, rutas API y componentes de UI.

| Rol | Alcance principal |
|-----|-------------------|
| `ADMIN` | Acceso completo a todos los módulos |
| `IT` | Tickets, equipos, asignaciones, compras |
| `RRHH` | Usuarios, oficios, asistencia, inventario |
| `USER` | Dashboard, tickets propios, asistencia, consulta de equipos |

La matriz de permisos se define en `src/lib/permissions.ts`.

## Estructura del Proyecto

```text
/
├── .github/              # Plantillas de incidencias y CI/CD (GitHub Actions)
├── docs/                 # Documentación formal del Ciclo de Vida (ISO 12207)
├── mockups/              # Referencias visuales de diseño
├── prisma/               # Esquema de base de datos y scripts de sembrado (seed)
├── src/
│   ├── actions/          # Server Actions de Next.js
│   ├── app/              # Rutas de frontend y API REST
│   ├── components/       # Componentes UI (shadcn/ui + layout + shared)
│   ├── hooks/            # Custom Hooks de React Query
│   ├── lib/              # Utilidades centrales (Auth, Prisma, RBAC, Zod)
│   ├── services/         # Capa de abstracción de datos
│   ├── stores/           # Almacenes de estado global (Zustand)
│   └── types/            # Definiciones de tipos de TypeScript
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
JWT_SECRET="clave-segura-de-al-menos-32-caracteres"
```

> **Atención:** `JWT_SECRET` debe ser una clave criptográfica segura y distinta en producción. Nunca exponga variables de servidor con el prefijo `NEXT_PUBLIC_`.

### 3. Instalar dependencias

```bash
npm install
```

### 4. Inicializar base de datos

Sincronizar el esquema de Prisma y poblar los datos iniciales (seed):

```bash
npm run prisma:push
npm run prisma:seed
```

## Ejecución

**Modo desarrollo:**

```bash
npm run dev
```

**Compilación y producción:**

```bash
npm run build
npm run start
```

**Otros comandos útiles:**

```bash
npm run lint              # Análisis estático ESLint
npm run prisma:generate   # Regenerar cliente Prisma
npm run prisma:studio     # Explorador visual de la base de datos
```

## Pruebas

El proyecto incluye pruebas unitarias para utilidades críticas (autenticación, permisos):

```bash
npx vitest                # Ejecutar pruebas una vez
npx vitest --watch        # Modo observador
npx vitest --ui           # Interfaz gráfica
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
