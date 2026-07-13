# Plan de Entrega — SGE a Producción en 4 Semanas

> **Versión:** 1.0
> **Fecha:** 13 jul 2026
> **Plataforma objetivo:** AWS
> **Alcance MVP:** Roles `ADMIN` + `IT`
> **Módulos deprecados:** Tickets, Inventario Promocional, Asistencia

Este documento es ejecutable. Cada tarea tiene responsable, duración estimada y entregable verificable. Se asume un equipo de **5 personas** (4.5 FTE) durante **20 días hábiles** (4 sprints de 1 semana).

---

## 0. Decisiones de Alcance (firmadas al inicio)

| # | Decisión | Implicación |
|---|---|---|
| D1 | **Deprecar** Tickets, Inventario Promocional y Asistencia | Eliminar páginas, hooks y servicios del frontend. Mantener backend accesible vía API, documentado como "interno" en OpenAPI/Swagger |
| D2 | **Deploy en AWS** (Fargate/App Runner + RDS o Neon sobre AWS) | Requiere Dockerfile, S3 para uploads, Secrets Manager/SSM para secretos, IaC mínimo |
| D3 | MVP funcional con roles **ADMIN** + **IT** | USER queda con dashboard y consulta mínima. RRHH se activa en fase 2 |
| D4 | Persistencia de archivos en **S3** desde el día 1 | Elimina dependencia de `public/uploads/` y bloquea el riesgo serverless |
| D5 | Migrar de `prisma db push` a **`prisma migrate deploy`** con carpeta `migrations/` | Necesario para producción |
| D6 | Rotar secretos del `.env` versionado | Acción crítica antes de cualquier merge a `main` |

---

## 1. Resumen de Hallazgos de Auditoría

### 1.1 Lo que está listo (verde)
- Autenticación JWT (1h), bcrypt, sesión HttpOnly
- RBAC en 3 capas (middleware Edge + `withAuth` en API + UI)
- Módulos completos: **Oficios** (con numeración oficial), **Equipos**, **Asignaciones**, **Empleados**, **Auditoría ISO 19011**, **Auditoría de logs transversales**, **Compras** (flujo principal), **Dashboard**
- UI shadcn/ui + dark/light mode, headers de seguridad, CSP básica
- Documentación ISO 12207/25010/27001 completa
- CI ejecuta tsc + lint + vitest + build

### 1.2 Lo que falta (ámbar/rojo)
| # | Hallazgo | Severidad | Sprint |
|---|---|---|---|
| H1 | ~3.500 líneas de código sin commitear (67 archivos) | 🔴 Crítica | S1 |
| H2 | `.env` versionado en el repo (rotación de secretos) | 🔴 Crítica | S1 |
| H3 | Sin `Dockerfile`, sin `vercel.json`, sin IaC AWS | 🔴 Crítica | S1 |
| H4 | Storage en `public/uploads/` (no funciona en serverless) | 🔴 Crítica | S1/S2 |
| H5 | Endpoints `/api/corrective-actions/*` retornan 501 | 🟠 Alta | S2 |
| H6 | `PATCH/DELETE` faltantes en `/api/users/[id]`, `/api/purchases/[id]`, `/api/promotional-items/[id]`, `/api/time-entries/[id]` | 🟠 Alta | S1/S2 |
| H7 | Inconsistencia `middleware.ts` ↔ `lib/permissions.ts` (USER ve API pero no página) | 🟠 Alta | S2 |
| H8 | Tickets/Invetory/Time-entries deshabilitados: deprecar formalmente | 🟡 Media | S2 |
| H9 | Solo 1 test unitario (cobertura ~3%) | 🟠 Alta | S3 |
| H10 | CSP permite `unsafe-inline` y `unsafe-eval` | 🟡 Media | S1/S3 |
| H11 | `Oficio.status` es `String` libre sin validación enum | 🟡 Media | S2 |
| H12 | `/audit-records` y `/admin/audit-logs` son vistas duplicadas | 🟡 Media | S2 |
| H13 | `/settings` solo toggle dark mode | 🟡 Media | S2 |
| H14 | `prisma/prisma_new.prisma` huérfano | 🟢 Baja | S1 |
| H15 | `CHANGELOG.md` no actualizado desde v0.1.0 | 🟢 Baja | S4 |

### 1.3 Métricas de salud

| Dimensión | Hoy | Objetivo S4 |
|---|---|---|
| Cobertura de tests | ~3% | ≥60% |
| Hallazgos OWASP TOP 10 abiertos | 4 (CSP, refresh tokens, rate limit, IDOR exhaustivo) | 0 críticos, ≤2 medios documentados |
| Commits atrasados | 67 archivos / ~3.500 LoC | 0 |
| Endpoints 501 / stubs | 6+ | 0 |
| Build passing | ✅ | ✅ + tests + cobertura |

---

## 2. Equipo

| Rol | FTE | Persona | Foco |
|---|---|---|---|
| **Tech Lead / PM** | 0.5 | TL | Decisiones, code review, riesgos, release |
| **Backend Dev A** | 1.0 | BA | CRUD faltante, Corrective Actions, Prisma migrate |
| **Backend Dev B** | 1.0 | BB | AWS, S3, Secrets Manager, seguridad, RBAC |
| **Frontend Dev** | 1.0 | FE | Deprecación módulos, unificación vistas, settings real |
| **QA / DevOps** | 1.0 | QA | Tests, CI/CD, Dockerfile/IaC, runbook, smoke |

**Total: 4.5 FTE × 4 semanas ≈ 18 personas-semana.**

Ritmo: Daily 15 min (async escrito), planning lunes, review viernes, demo final de sprint viernes 16:00.

---

## 3. Roadmap por Sprints

### 🔴 Sprint 1 — Estabilizar y limpiar (Semana 1)

**Objetivo:** Repo sano, reproducible, sin secretos filtrados, deploy-able a AWS.

| Día | Backend A (BA) | Backend B (BB) | Frontend (FE) | QA/DevOps (QA) |
|---|---|---|---|---|
| **L** | Commitear `prisma/schema.prisma` y `seed.ts` en PR temático. Borrar `prisma_new.prisma` huérfano | **Rotar secretos** del `.env` versionado y purgarlo del historial (`git filter-repo`). Actualizar `.env.example` con todas las vars | Decidir formalmente deprecación: eliminar páginas `/tickets`, `/inventory`, `/time-entries` (frontend) | Activar protección de `main`, requerir CI verde para merge |
| **M** | Inicializar `prisma/migrations/` con baseline controlado (`migrate dev --create-only` + revisión) | Crear interface `StorageAdapter` (`put`, `getSignedUrl`, `delete`). Driver `LocalStorageAdapter` (dev) y stub `S3StorageAdapter` | Quitar `DISABLED_ROUTES` del middleware. Eliminar del sidebar: Tickets/Inventario/Asistencia | `npm audit` + actualizar deps críticas. Crear `Dockerfile` multi-stage (Node 20-alpine) |
| **X** | PR `users`: `GET/PATCH/DELETE /api/users/[id]` con RBAC | Implementar driver `S3StorageAdapter` con `@aws-sdk/client-s3`. Variables `S3_BUCKET`, `AWS_REGION` | Borrar carpetas `src/app/{tickets,inventory,time-entries}/`, hooks asociados y `DISABLED_ROUTES` | Crear `docker-compose.yml` local (Postgres + MinIO simulando S3). Probar `docker compose up` |
| **J** | PR `purchases`: `PATCH/DELETE /api/purchases/[id]` + implementar `/[id]/items` (reemplazar STUB) | Implementar `promotional-items/[id]` y `time-entries/[id]` PATCH/DELETE. Driver secrets via Secrets Manager | Unificar `/audit-records` y `/admin/audit-logs` → `/audit/logs` con tabs (mover `NAV_ITEMS`) | Configurar Dependabot, Snyk/CodeQL básico |
| **V** | Code freeze funcional S1. `npm run build` + `tsc --noEmit` limpios | CSP: introducir nonce y eliminar `unsafe-eval`. Mantener `unsafe-inline` solo en style por ahora | Limpiar imports muertos, `eslint .` limpio | Smoke E2E manual: login + dashboard + oficios + equipos en contenedor |

**Entregables S1 (Definition of Done):**
- [ ] Repositorio sin `.env`, con `.env.example` completo y documentado
- [ ] Historial git limpio (sin secretos), rama `develop` sincronizada
- [ ] `prisma/migrations/0000_init/migration.sql` generado y revisado
- [ ] `Dockerfile` + `docker-compose.yml` funcionales localmente
- [ ] Tickets/Inventario/Asistencia deprecados formalmente
- [ ] CI verde: tsc + lint + vitest + build
- [ ] Secrets en AWS Secrets Manager (en entorno staging, no todavía en prod)

---

### 🟡 Sprint 2 — Completar funcionalidad (Semana 2)

**Objetivo:** Cerrar todos los gaps funcionales restantes. Storage 100% en S3.

| Día | Backend A | Backend B | Frontend | QA/DevOps |
|---|---|---|---|---|
| **L** | **Acciones Correctivas**: implementar CRUD completo de `/api/corrective-actions` basado en modelo Prisma existente | Wirear `StorageAdapter` en `oficios-storage.ts` y `equipment-storage.ts` (mantener API pública) | Página `/settings` real: editar perfil, cambiar contraseña (Zod), ver políticas de asistencia | Tests integración: oficios CRUD, equipment CRUD, assignments CRUD |
| **M** | Endpoint para vincular `CorrectiveAction` con `AuditFinding` | Migrar archivos físicos de `public/uploads/` a S3 (script one-shot + cutover) | Reasignar uploads a S3 desde el frontend (presigned URLs) | Tests integración: corrective-actions, audits |
| **X** | Refactor `middleware.ts` ↔ `lib/permissions.ts`: una sola fuente de verdad. Generar tests de matriz | Habilitar Signed URLs (15 min TTL) para descargas privadas | Página `/employees` con departamentos y posiciones anidadas (ya existe) | Tests unitarios: `oficios-numbering.ts`, `permissions.ts`, `equipment-mapper.ts` |
| **J** | Cambiar `Oficio.status` de `String` a enum (`OficioStatus`) con migración de datos | Healthcheck `/api/health` (DB + S3), métricas CloudWatch | Smoke visual de toda la UI habilitada | Pipeline E2E con Playwright (configuración inicial) |
| **V** | Code review cruzado | Pruebas de carga básicas en staging interno | Fixes visuales post-review | Suite E2E smoke: login → crear oficio → asignar equipo |

**Entregables S2:**
- [ ] Todos los endpoints devuelven 2xx en operaciones válidas (sin 501)
- [ ] Storage desacoplado al 100%, files en S3
- [ ] Matriz RBAC única, documentada y testeada
- [ ] Healthcheck operativo
- [ ] E2E básico verde

---

### 🟢 Sprint 3 — Calidad y endurecimiento (Semana 3)

**Objetivo:** Cobertura ≥60% en código crítico. OWASP cerrado. CSP endurecido.

| Día | Backend A | Backend B | Frontend | QA/DevOps |
|---|---|---|---|---|
| **L** | Tests unitarios: `auth.ts`, `session.ts`, `audit.ts` (≥25 casos) | Auditoría OWASP A01 (IDOR exhaustivo en todas las rutas USER) | Tests componentes: `MainLayout`, `OficiosScopePage`, `Equipment` page | Subir cobertura en CI (`vitest --coverage --reporter=lcov`) |
| **M** | Tests API: tickets (deprecados, solo mantener), oficios, equipment, assignments, audits | Implementar rate limiting en Edge (token bucket por IP+userId) | Tests componentes: employees, purchases, dashboard | Cobertura ≥60% en `src/lib` + `src/services` + API routes |
| **X** | Tests API: corrective-actions, purchases, promotional-items | Cabeceras: añadir COOP/COEP, validar nonce para `script-src` | Auditoría Lighthouse móvil (perf + a11y ≥80) | Documentar runbook de backup/restore Neon + S3 versioning |
| **J** | Tests E2E (Playwright): login, crear oficio, asignar equipo, generar auditoría | Eliminar `as any`, tipar errores (`PrismaClientKnownRequestError` discriminado) | Auditoría accesibilidad básica (roles ARIA, contraste, foco visible) | Pruebas de carga k6/Artillery en `/api/oficios` (50 RPS) |
| **V** | Fix hallazgos S3 | CSP final sin `unsafe-eval` y con nonce. Style-src seguir con `unsafe-inline` por SSR | Fix hallazgos Lighthouse y a11y | **Acta de Pruebas S3** firmada por TL + QA |

**Entregables S3:**
- [ ] Cobertura Vitest ≥60% en código crítico
- [ ] 0 hallazgos OWASP críticos
- [ ] CSP endurecido (sin `unsafe-eval`)
- [ ] Lighthouse ≥80 en las 4 páginas principales
- [ ] Runbook operativo probado

---

### 🚀 Sprint 4 — Deploy, release y entrega (Semana 4)

**Objetivo:** Producción en AWS, smoke real, capacitación, acta de entrega.

| Día | Backend A | Backend B | Frontend | QA/DevOps |
|---|---|---|---|---|
| **L** | Crear migración inicial limpia + backup pre-deploy | Desplegar **staging AWS**: Fargate o App Runner + RDS o Neon AWS + S3 + Secrets Manager + CloudWatch | Smoke staging de todos los módulos | IaC mínimo: Terraform o CDK con VPC, ALB, ECS task, RDS, S3, IAM |
| **M** | Monitoreo post-staging: logs estructurados, métricas | Wirear Sentry/Datadog, alarmes CloudWatch | Fix bugs visuales de staging,第二轮 UX | Simular PITR restore desde staging |
| **X** | **Deploy producción** (ventana acordada con stakeholders) | Verificar TLS (ACM), headers, CSP producción, backups WORM | Validación final post-producción con usuario piloto | Smoke producción con usuario real |
| **J** | Soporte de bugs post-deploy (war room) | Soporte de bugs post-deploy | Capacitación usuarios: 1 sesión grabada + manual PDF | Runbook firmado + handover a operaciones |
| **V** | Cierre: acta de entrega firmada, lessons learned, CHANGELOG v1.0.0 | Cierre | Cierre | Cierre + Plan 30/60/90 días |

**Entregables S4:**
- [ ] Sistema en producción AWS, accesible vía URL definitiva
- [ ] Backups verificados (PITR Neon/S3 inmutable 30d)
- [ ] Monitoreo y alertas operativos (24/7)
- [ ] Acta de Entrega firmada
- [ ] Plan de mantenimiento 30/60/90 días entregado
- [ ] `CHANGELOG.md` actualizado a v1.0.0

---

## 4. Arquitectura AWS Objetivo

```
                    ┌─────────────────────┐
                    │   CloudFront (CDN)  │ ← opcional para estáticos
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │     ALB / WAF       │ ← reglas OWASP, rate limit
                    └──────────┬──────────┘
                               │
                  ┌────────────▼─────────────┐
                  │  ECS Fargate / App Runner │
                  │  (Next.js Node 20-alpine) │
                  │  Task Definition + ECR   │
                  └────┬──────────┬──────────┘
                       │          │
        ┌──────────────▼─┐    ┌───▼────────────┐
        │ RDS PostgreSQL │    │  Amazon S3     │
        │ (o Neon AWS)   │    │  oficios/      │
        │ Multi-AZ       │    │  equipment/    │
        └────────────────┘    └────────────────┘
                       │
        ┌──────────────▼─────────────┐
        │  AWS Secrets Manager / SSM │
        │  DATABASE_URL, JWT_SECRET, │
        │  AWS_ACCESS_KEY_ID         │
        └────────────────────────────┘
                       │
        ┌──────────────▼─────────────┐
        │  CloudWatch Logs + Alarmas │
        │  Sentry/Datadog APM        │
        └────────────────────────────┘
```

### 4.1 Servicios AWS requeridos

| Servicio | Propósito | Costo aprox/mes |
|---|---|---|
| ECS Fargate (1 task 0.5 vCPU, 1GB) | App Next.js | ~$15 |
| ALB | Distribución | ~$20 |
| RDS db.t4g.micro Multi-AZ | Postgres | ~$30 |
| S3 (10 GB) | Uploads | ~$1 |
| Secrets Manager | Secretos | ~$1 |
| CloudWatch Logs | Observabilidad | ~$5 |
| **TOTAL estimado** | | **~$70-100/mes** |

> **Optimización:** usar **Neon AWS** (free tier generoso) en lugar de RDS, y **App Runner** en lugar de Fargate si no se requiere VPC privada.

---

## 5. Riesgos y Mitigación

| ID | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| R1 | `.env` filtrado compromete credenciales | Alta | Crítico | Rotación **antes** del primer merge. Auditoría de uso |
| R2 | Storage local rompe en serverless | Alta (si no se migra) | Crítico | Migración S3 **en S1**, no aplazar |
| R3 | Trabajo sin commitear introduce regresiones | Media | Alto | PRs temáticos pequeños + revisión obligatoria |
| R4 | Auditoría IDOR encuentra rutas pasadas | Media | Crítico | Auditoría sistemática S3 + fix antes de release |
| R5 | "1 mes" se interpreta como naturales, no hábiles | Alta | Medio | Plan算 explícitamente en **20 días hábiles** |
| R6 | Dependabot trae breaking changes | Media | Bajo | Política: auto-merge solo parches; manual minor+ |
| R7 | Capacidad del equipo <4.5 FTE | Media | Alto | Renegociar alcance: deprecar más módulos, MVP reducido |
| R8 | Costo AWS superior al estimado | Baja | Bajo | Monitoreo de costos diario en S4 |
| R9 | Falla integración con Neon PostgreSQL | Baja | Medio | Healthcheck desde S2, smoke desde S3 |
| R10 | Capacitación a usuarios insuficiente | Media | Medio | Manual PDF + 1 sesión grabada + dry-run Jueves S4 |

---

## 6. Checklist Pre-Producción (Definition of Released)

### 6.1 Funcional
- [ ] Login/logout/refresh operativo
- [ ] Dashboard carga <2s con datos reales
- [ ] CRUD Oficios con numeración oficial (CNI/DPICP/MEMO)
- [ ] CRUD Equipos con asset code auto (`TI-LAP-0001`)
- [ ] CRUD Asignaciones con entrega/devolución/swap
- [ ] CRUD Empleados + Departamentos + Posiciones
- [ ] CRUD Auditoría ISO + Hallazgos + Checklist
- [ ] Acciones Correctivas operativas
- [ ] Compras (flujo principal sin sub-items avanzados)
- [ ] Logs transversales con filtros

### 6.2 Calidad
- [ ] `tsc --noEmit` limpio
- [ ] `eslint .` sin errores
- [ ] `npm run build` exitoso
- [ ] Vitest ≥60% cobertura crítica
- [ ] Playwright E2E smoke verde
- [ ] Lighthouse ≥80 en páginas principales
- [ ] OWASP TOP 10 cerrado (0 críticos)

### 6.3 Seguridad
- [ ] Secretos en AWS Secrets Manager, nunca en repo
- [ ] CSP sin `unsafe-eval`
- [ ] Headers: HSTS, X-Frame-Options, X-Content-Type-Options, COOP, COEP
- [ ] JWT con expiración y validación en Edge + API
- [ ] Rate limit en login y APIs sensibles
- [ ] Auditoría IDOR exhaustiva pasada

### 6.4 Operación
- [ ] Dockerfile reproducible (`docker build` exitoso local)
- [ ] IaC mínimo Terraform/CDK versionado
- [ ] CloudWatch dashboards y alarmas
- [ ] Backups verificados (PITR + S3 inmutable)
- [ ] Runbook de incidentes firmado
- [ ] Monitoreo Sentry/Datadog operativo

### 6.5 Documentación
- [ ] `README.md` actualizado
- [ ] `CHANGELOG.md` con v1.0.0
- [ ] Acta de entrega firmada
- [ ] Manual de usuario PDF
- [ ] Plan de mantenimiento 30/60/90
- [ ] OpenAPI/Swagger de los endpoints públicos

---

## 7. Comunicación y Ceremonias

| Ceremonia | Frecuencia | Duración | Asistentes |
|---|---|---|---|
| Daily (async escrito en Slack/Teams) | Diaria | 5 min | Todos |
| Sprint Planning | Lunes S1..S4 | 1h | Todos |
| Sprint Review / Demo | Viernes S1..S3 | 1h | Todos + stakeholders |
| Retrospectiva | Viernes S1..S3 | 30 min | Todos |
| Release Readiness | Jueves S4 | 1h | TL + stakeholders |
| Post-release retro | Viernes S4 | 1h | Todos |

---

## 8. Estimación Total

| Concepto | Horas/persona |
|---|---|
| S1 — Estabilizar | 90h |
| S2 — Completar | 80h |
| S3 — Calidad | 75h |
| S4 — Release | 50h |
| **TOTAL** | **~295h ≈ 18 persona-semana** |

Con 4.5 FTE en 4 semanas (180h/semana × 4 = 720h capacidad), hay holgura del ~60% para imprevistos.

---

## 9. Referencias Internas

- Auditoría técnica completa: este documento §1
- Stack tecnológico: `README.md`
- Documentación ISO 12207: `docs/`
- Checklist de calidad: `docs/checklist-calidad-software.md`
- Política de seguridad: `docs/security_policy.md`
- Plan de backups: `docs/database_backups.md`
- Hallazgos previos: `hallazgoz.md`
- Plan de refactorización UI: `implementation_plan.md`

---

**Aprobación requerida antes de iniciar S1:**

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Product Owner | | | |
| Tech Lead | | | |
| Stakeholder AWS/Infra | | | |
