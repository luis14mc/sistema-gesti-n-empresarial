# ADR 001: Selección del Stack Tecnológico Principal

## Estado
Aceptado

## Contexto
El sistema requiere una plataforma unificada para gestionar múltiples módulos empresariales (Tickets, Oficios, Asistencias, Inventario, Compras). Se necesita un stack que permita un desarrollo rápido, tipado estricto y excelente rendimiento de servidor para proteger la lógica de negocio.

## Decisión
Se ha decidido utilizar el siguiente stack tecnológico:
- **Framework:** Next.js 14+ (App Router)
- **Lenguaje:** TypeScript estricto
- **ORM:** Prisma
- **Base de Datos:** PostgreSQL (alojada en Neon.tech)
- **Estilos:** Tailwind CSS con componentes shadcn/ui
- **Gestión de Estado:** Zustand (cliente) y React Query (peticiones asíncronas)

## Consecuencias
- **Positivas:** 
  - Ecosistema unificado (React + Node.js) en un solo repositorio (monorepo).
  - TypeScript End-to-End garantiza que los tipos de la base de datos coincidan con el cliente.
  - Vercel/Next.js facilita despliegues sin servidor (Serverless).
- **Negativas:** 
  - Curva de aprendizaje para el paradigma de Server Components de Next.js.
  - Dependencia de un entorno Node/Edge para el servidor.
