# Acta de Entrega — SGE v1.0.0

> **Sistema de Gestión Empresarial**
> **Versión entregada:** 1.0.0
> **Fecha de release:** 13 jul 2026
> **Plataforma:** AWS (ECS Fargate + ALB + RDS-compatible/Neon + S3)

---

## 1. Alcance entregado

### Módulos funcionales (UI + API + Tests)

| Módulo | UI | API | Auditoría | Soft Delete |
|---|---|---|---|---|
| **Oficios** (CNI/Despacho/Internos) | ✅ | ✅ | ✅ | n/a (anulado) |
| **Equipos** | ✅ | ✅ | ✅ | ✅ |
| **Asignaciones** (entrega/devolución/swap) | ✅ | ✅ | ✅ | ✅ |
| **Empleados** | ✅ | ✅ | ✅ | ✅ |
| **Auditoría ISO** (hallazgos/checklist) | ✅ | ✅ | ✅ | n/a |
| **Acciones Correctivas** | n/a | ✅ | ✅ | ✅ hard |
| **Compras** | ✅ | ✅ | ✅ | ✅ |
| **Usuarios** | ✅ | ✅ | ✅ | ✅ (isActive) |
| **Dashboard** | ✅ | n/a | n/a | n/a |
| **Auditoría transversal** | ✅ | ✅ | n/a | inmutable |
| **Ajustes** (perfil + contraseña + tema) | ✅ | ✅ | ✅ | n/a |

### Módulos formalmente deprecados (frontend eliminado)

- Tickets (HelpDesk)
- Inventario Promocional
- Asistencia / Time Entries

> Las APIs internas permanecen accesibles para integraciones, sin UI.

### Calidad

- ✅ **75 tests** unitarios/integración (Vitest)
- ✅ **Cobertura 88.77%** statements / 92.12% lines (objetivo: 60%)
- ✅ TypeScript estricto: 0 errores
- ✅ ESLint: 0 errores (98 warnings preexistentes tipados)
- ✅ Build producción: 0 errores

---

## 2. Seguridad aplicada

| Control | Estado | Detalle |
|---|---|---|
| CSP nonce dinámico | ✅ | middleware genera por request, `strict-dynamic` |
| OWASP A01 IDOR | ✅ | helper centralizado + filtros en endpoints |
| OWASP A02 Crypto | ✅ | bcrypt 10 rounds + JWT 1h + SECRET min 32 chars |
| OWASP A03 Injection | ✅ | Prisma typed + Zod schemas en todas las rutas |
| OWASP A05 Misconfig | ✅ | HSTS, XFO, XCTO, COOP, COEP, Permissions-Policy |
| OWASP A07 Auth | ✅ | Rate limit 5/min en login + delay 500ms |
| OWASP A08 Integrity | ✅ | `createAuditRecord` aborta transacción si falla |
| Rate limit en Edge | ✅ | Sliding window in-memory (Upstash-ready) |
| Audit log inmutable | ✅ | Tabla AuditRecord sin UPDATE en código de app |

---

## 3. Documentación entregada

| Documento | Ubicación |
|---|---|
| Plan de entrega | `docs/00-plan-entrega-1-mes.md` |
| Manual de usuario | `docs/MANUAL-USUARIO.md` |
| Runbook AWS | `docs/runbook-aws.md` |
| Changelog | `CHANGELOG.md` |
| Security policy | `docs/security_policy.md` |
| Database backups | `docs/database_backups.md` |
| ADRs | `docs/adr/` |
| ISO docs | `docs/01-07` |
| Infra README | `infra/terraform/README.md` |

---

## 4. Procedimientos operativos

### 4.1. Deploy

```bash
# 1. Construir y subir imagen
docker build -t sge:v1.0.0 .
docker push ${ECR_URI}/production:v1.0.0

# 2. Aplicar IaC
cd infra/terraform
terraform apply -var="container_image=${ECR_URI}/production:v1.0.0"

# 3. Migración Prisma (si aplica)
npx prisma migrate deploy

# 4. Smoke test
./scripts/smoke-test.sh https://$(terraform output -raw alb_dns_name)
```

Referencia completa: `docs/runbook-aws.md`.

### 4.2. Rollback

```bash
# Re-deploy versión anterior
terraform apply -var="container_image=${ECR_URI}/production:v0.9.0"
```

### 4.3. Backup

- **PostgreSQL:** PITR Neon 7 días
- **Archivos S3:** Versionado + lifecycle GLACIER 90d + retención 7 años

---

## 5. Costos operativos estimados

| Recurso | Producción | Staging |
|---|---|---|
| ECS Fargate (2× tasks, 0.5 vCPU, 1GB) | $16 | $8 |
| ALB | $20 | $20 |
| RDS/Neon | $30 | Free tier |
| S3 (10GB + ops) | $2 | $1 |
| CloudWatch Logs (10GB) | $5 | $3 |
| SSM Secrets | $1 | $1 |
| Data transfer | $5 | $2 |
| **TOTAL** | **~$80/mes** | **~$35/mes** |

---

## 6. Compliance

- ✅ **ISO/IEC/IEEE 12207** SDLC documentado en `docs/`
- ✅ **ISO/IEC 25010** checklist en `docs/checklist-calidad-software.md`
- ✅ **ISO/IEC 27001 A.8.13** backup policy en `docs/database_backups.md`
- ✅ Auditoría transversal inmutable (ISO 27001 A.12.4)
- ✅ ADR-001 stack tecnológico, ADR-002 RBAC security

---

## 7. Firmas de aceptación

| Rol | Nombre | Firma | Fecha |
|---|---|---|---|
| Product Owner | __________________ | __________________ | _________ |
| Tech Lead | __________________ | __________________ | _________ |
| Stakeholder Seguridad | __________________ | __________________ | _________ |
| Stakeholder Infraestructura | __________________ | __________________ | _________ |

---

## 8. Plan post-release (30/60/90 días)

### Sprint 5 (0-30 días)
- WAF + rate limiting distribuido (Cloudflare/Upstash)
- Búsqueda global cross-módulo
- Notificaciones por email (login, asignación, etc.)
- Métricas de uso con Datadog/Sentry

### Sprint 6 (30-60 días)
- Módulo Nómina (Cálculo de planillas básico)
- App móvil para marcaje de asistencia
- Integración con SAT / DIAN (facturación)

### Sprint 7 (60-90 días)
- Workflow de aprobaciones configurable
- Reportes exportables (PDF/Excel)
- Multi-tenant (múltiples empresas en misma instalación)
