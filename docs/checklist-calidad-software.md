# Checklist de Calidad de Software

Este checklist es de uso obligatorio antes de aprobar cualquier *Release* a Producción (Main branch merge). Está fundamentado en las normativas **ISO/IEC/IEEE 12207** (Procesos del Ciclo de Vida) e **ISO/IEC 25010** (Atributos de Calidad).

## 1. Verificación Documental (Procesos)
- [ ] **Requisitos documentados:** El PR soluciona un RFC o Issue registrado.
- [ ] **Diseño aprobado:** Si altera la arquitectura, el archivo ADR correspondiente está actualizado.
- [ ] **Código versionado:** Los cambios están fusionados desde una rama funcional (feature/*) mediante un PR.
- [ ] **Variables de entorno:** Si hay nuevas credenciales requeridas, `.env.example` ha sido actualizado (con placeholders).
- [ ] **Acta de entrega / Changelog:** Se ha documentado la versión en `CHANGELOG.md`.
- [ ] **Manuales / Guías:** Se actualizaron `README.md` o secciones en `/docs/` si aplicaba.

## 2. Verificación Técnica (Calidad ISO 25010)
- [ ] **Pruebas funcionales realizadas:** La función nueva ejecuta correctamente sus flujos primarios de éxito y error.
- [ ] **Pruebas de seguridad básicas:** Endpoints están protegidos con `withAuth()` y prevención IDOR en Prisma (Validación de roles/permisos correcta).
- [ ] **Pruebas de rendimiento básicas:** Las consultas de API nuevas tienen un `pageSize` limitado a máximo 100 registros.
- [ ] **Manejo de errores:** Bloques `try/catch` adecuados, sin exponer *stack traces* completos al frontend.
- [ ] **Logs o Auditoría:** Las funciones destructivas o sensibles llaman a `createAuditRecord()`.
- [ ] **Pruebas automatizadas (Testing):** La suite automatizada (`npm run test`) reporta `PASS`. El linter (`npm run lint`) y Type Checker no reportan errores.

## 3. Verificación Operacional
- [ ] **Respaldo de base de datos:** Si es un paso a producción masivo o implica migraciones estructurales, se verificó el último respaldo de la base de datos Neon.tech.
- [ ] **Plan de mantenimiento:** En caso de refactorización extensa, se comunicó a los usuarios sobre posible downtime.
