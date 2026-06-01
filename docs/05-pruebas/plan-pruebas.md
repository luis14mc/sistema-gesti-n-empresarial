# Plan de Pruebas del Software

## 1. Objetivo
Garantizar que el sistema cumpla sistemáticamente con los requisitos funcionales y no funcionales definidos, validando la estabilidad en cada etapa del desarrollo.

## 2. Tipos de Pruebas Implementadas
- **Pruebas Unitarias:** Evalúan utilidades asiladas (ej. validación JWT, hashing).
- **Análisis Estático (Type Checking):** Realizado por el compilador de TypeScript en la integración continua.
- **Pruebas Manuales (Ad-Hoc):** Validaciones realizadas por el equipo de QA en la interfaz de usuario.

## 3. Entorno de Pruebas
- **Framework:** `Vitest` (Unitarias)
- **Ejecución Automatizada:** Integrado en `.github/workflows/ci.yml`.

## 4. Estrategia de Ejecución
Las pruebas se ejecutan de manera forzada ante cada nuevo *Pull Request*. Si la tasa de éxito de las pruebas decae de 100%, el sistema de CI bloqueará automáticamente la fusión hacia `develop`.
