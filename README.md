# Sistema de Gestión Empresarial (SGE)

## Descripción General
El **Sistema de Gestión Empresarial (SGE)** es una plataforma integral diseñada para centralizar, controlar y auditar los procesos operativos corporativos. Provee módulos especializados para la administración de personal, control de inventarios, asignación de equipos informáticos, sistema de tickets (HelpDesk) y trazabilidad documental (Oficios).

Este proyecto sigue metodologías formales de ciclo de vida de desarrollo de software (SDLC) inspiradas en la normativa **ISO/IEC/IEEE 12207** y cuenta con controles de calidad bajo la norma **ISO/IEC 25010**.

## Stack Tecnológico
- **Frontend / Framework:** Next.js 16 (App Router) / React 19
- **Lenguaje:** TypeScript 5
- **Estilos:** Tailwind CSS v4, Componentes shadcn/ui
- **Gestor de Estado:** Zustand, React Query
- **Backend / ORM:** Prisma ORM
- **Base de Datos:** PostgreSQL (Neon.tech)
- **Seguridad:** JWT, bcryptjs, RBAC Middleware
- **Pruebas Automatizadas:** Vitest, React Testing Library

## Estructura del Proyecto
```text
/
├── .github/              # Plantillas de incidencias y CI/CD (GitHub Actions)
├── docs/                 # Documentación formal del Ciclo de Vida (ISO 12207)
├── prisma/               # Esquema de base de datos y scripts de sembrado (seed)
├── src/
│   ├── actions/          # Server Actions de Next.js
│   ├── app/              # Rutas de frontend y API REST
│   ├── components/       # Componentes de interfaz de usuario
│   ├── hooks/            # Custom Hooks de React
│   ├── lib/              # Utilidades centrales (Auth, Prisma, RBAC, Zod)
│   ├── services/         # Capa de abstracción de datos
│   ├── stores/           # Almacenes de estado global (Zustand)
│   └── types/            # Definiciones de tipos de TypeScript
```

## Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone <url-repositorio>
cd sistema-gestion-empresarial
```

### 2. Configurar variables de entorno
Copiar el archivo de plantilla y llenar las credenciales necesarias:
```bash
cp .env.example .env
```
*Atención: Asegúrese de que `JWT_SECRET` contenga una clave criptográfica segura en el entorno de producción.*

### 3. Instalar dependencias
```bash
npm install
```

### 4. Inicializar base de datos
Sincronizar el esquema de Prisma y poblar los datos iniciales (Seed):
```bash
npx prisma db push
npx prisma db seed
```

## Ejecución

**Modo Desarrollo:**
```bash
npm run dev
```

**Compilación y Producción:**
```bash
npm run build
npm run start
```

## Pruebas
El proyecto cuenta con pruebas unitarias para validación de utilidades críticas.
```bash
npm run test       # Ejecutar pruebas una vez
npm run test:watch # Ejecutar pruebas en modo observador
```

## Documentación Disponible
Toda la documentación arquitectónica, técnica y operativa se encuentra en el directorio [`/docs`](./docs/):
- **Diseño y Arquitectura:** [`/docs/03-diseno/`](./docs/03-diseno/)
- **Guías de Despliegue:** [`/docs/06-implementacion/`](./docs/06-implementacion/)
- **Gestión de Calidad:** [`/docs/checklist-calidad-software.md`](./docs/checklist-calidad-software.md)
- **ADRs (Registros de Decisión):** [`/docs/adr/`](./docs/adr/)

## Control de Versiones y Contribución
Este proyecto utiliza **Git Flow** simplificado. Para contribuir, revise nuestra [Guía de Contribución](CONTRIBUTING.md) y consulte el registro de cambios en el [CHANGELOG.md](CHANGELOG.md).
- **Ramas Principales:** `main` (Producción), `develop` (Desarrollo Integrado).

## Licencia
Propiedad corporativa privada. Prohibida su distribución.
