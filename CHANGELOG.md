# Changelog

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/), y este proyecto adhiere de forma estricta a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-01

### Agregado
- Estructura documental y de gobernanza basada en la norma ISO/IEC/IEEE 12207.
- Documentación inicial de las fases del proyecto (Inicio, Requisitos, Diseño, Desarrollo, Pruebas, Implementación, Mantenimiento).
- Checklist formal de calidad de software (ISO 25010).
- Guía de contribución (`CONTRIBUTING.md`) y política de seguridad (`SECURITY.md`).
- Plantillas para la gestión de incidencias (`bug_report`, `feature_request`, `change_request`).
- Refuerzo de Seguridad Perimetral: CI/CD, Content Security Policy, y rotación de tokens JWT.
- Integración de entorno de pruebas con Vitest y React Testing Library.

### Cambiado
- Consolidación del archivo `README.md` hacia un formato institucional.
- Refactorización de capa API para utilizar tipos estrictos `Prisma.*WhereInput`, mitigando riesgos lógicos.
- Optimización de paginación limitando `pageSize` a 100 registros máximos.

### Corregido
- Vulnerabilidad crítica de Control de Acceso (IDOR) en endpoints de Tickets, Equipos y Asistencia.
- Falla silenciosa en el registro de auditoría (`createAuditRecord`) que comprometía la integridad transaccional.
- Limpieza de código residual y archivos huérfanos (`test-db.js`, scripts VB).
