# Estándares de Código

## 1. Objetivo
Garantizar la uniformidad, legibilidad y mantenibilidad del código fuente a través del equipo de desarrollo.

## 2. Convenciones de Nomenclatura
- **Archivos y Carpetas:** Kebab-case (e.g., `user-profile.tsx`, `auth-service.ts`).
- **Componentes React:** PascalCase (e.g., `Button`, `NavigationMenu`).
- **Hooks:** camelCase y prefijo `use` (e.g., `useAuth`, `useTickets`).
- **Constantes Globales:** UPPER_SNAKE_CASE (e.g., `API_BASE_URL`).
- **Funciones y Variables:** camelCase (e.g., `fetchUserData`, `ticketList`).

## 3. Tipado Estricto (TypeScript)
- Se prohíbe explícitamente el uso del tipo `any`.
- Cuando interactúe con Prisma, utilice sus tipos autogenerados (ej. `Prisma.UserWhereInput` en lugar de constructos genéricos).

## 4. Validaciones de Datos
- Las validaciones del lado del servidor son **obligatorias**. Use siempre esquemas de `Zod` (ubicados en `src/lib/zod-schemas.ts`).

## 5. Prácticas de Rendimiento
- **Next.js:** Favorecer Server Components por sobre Client Components. Utilice `'use client'` estrictamente solo en componentes interactivos o que usen hooks de React.
- **Consultas DB:** Evitar consultas "N+1". Utilice `include` en Prisma para obtener relaciones necesarias en una sola operación.

## 6. Linter y Formato
- Todo el código debe superar la evaluación de ESLint y el formateador integrado.

## 7. Responsabilidades de Equipo
- El Arquitecto y los Desarrolladores Senior son responsables de verificar el cumplimiento de este estándar en las revisiones de código (Pull Requests).
