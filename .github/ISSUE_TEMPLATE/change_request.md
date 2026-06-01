---
name: Solicitud de Cambio (RFC)
about: Proponer un cambio estructural, refactorización o cambio de tecnología.
title: "[RFC] "
labels: refactor, architecture
assignees: ''

---

## Objetivo
¿Cuál es el propósito principal de este cambio? ¿Qué problema arquitectónico o de deuda técnica resuelve?

## Descripción del Cambio
Explica detalladamente qué componentes, base de datos o lógica de negocio se verán afectados por este cambio.

## Justificación
¿Por qué necesitamos hacer este cambio ahora? (Ej. Mejoras de rendimiento, reducción de deuda técnica, estándares ISO).

## Criterios de Aceptación (Validación)
- [ ] Pruebas unitarias actualizadas y aprobadas.
- [ ] Documentación / ADR actualizado.
- [ ] Rendimiento no degradado.

## Plan de Rollback (Mantenimiento)
En caso de fallo crítico al desplegar, ¿cuál es el plan para revertir el sistema a su estado estable anterior?

## Observaciones Adicionales
Cualquier impacto secundario esperado en los usuarios u otros módulos.
