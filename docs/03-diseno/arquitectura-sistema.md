# Arquitectura del Sistema

## 1. Objetivo
Proveer una visión general de alto nivel sobre la arquitectura tecnológica y los patrones de diseño utilizados en el Sistema de Gestión Empresarial.

## 2. Descripción Arquitectónica
El sistema se ha construido bajo el patrón de **Arquitectura Limpia (Clean Architecture) adaptada para Serverless**, utilizando un marco monolítico unificado en Next.js.

### Capas del Sistema:
1. **Frontend (Capa de Presentación):** React 19 / Server Components. Maneja el HTML y la interactividad.
2. **Capa de Transporte (API REST):** `src/app/api/`. Expone endpoints HTTP estandarizados y los protege con RBAC Middleware.
3. **Capa de Servicios (Business Logic):** `src/services/`. Aísla la lógica de negocio de la capa HTTP.
4. **Capa de Datos (ORM):** Prisma (`src/lib/prisma.ts`). Interactúa con la base de datos PostgreSQL.

## 3. Diagrama C4 (Nivel 2 - Contenedores)
*(Pendiente de representación gráfica; abstracción de componentes)*
- **Web App (Next.js):** Ejecutado en el Edge y Serverless Functions.
- **Relational DB (PostgreSQL):** Base de datos principal alojada en Neon.tech.
- **Client App (Navegador):** SPA gestionada por React Query y Zustand.

## 4. Patrones de Diseño Utilizados
- **Repository Pattern:** Oculto tras los Servicios para las llamadas de Prisma.
- **Singleton:** Cliente de Prisma instanciado una sola vez en el servidor.
- **Middleware:** Para comprobación de autenticación en Edge.
- **Observer / Pub-Sub:** A través de React Query para invalidación de cachés de UI.

## 5. Responsable
Arquitecto de Software.
