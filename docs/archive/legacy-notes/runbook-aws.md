# Runbook Operativo — SGE en AWS

> Última revisión: 13 jul 2026 · Mantenedor: equipo SGE

Este documento describe procedimientos operacionales para el Sistema de Gestión Empresarial desplegado en AWS. Asume conocimiento básico de ECS, Fargate, S3 y SSM Parameter Store.

---

## 0. Topología

```
Usuarios
  │
  ▼ (HTTPS)
Application Load Balancer (sge-{env}-alb)
  │
  ▼
ECS Service (sge-{env}-service) — desired=2 tasks
  │
  ├─► S3 Bucket (sge-{env}-uploads-XXXXX)   — archivos
  ├─► SSM Parameter Store                    — DATABASE_URL, JWT_SECRET
  ├─► Neon PostgreSQL (externo)              — datos
  └─► CloudWatch Logs (/ecs/sge-{env}/app)   — logs contenedor
```

**Región:** `us-east-2` (configurable vía `TF_VAR_aws_region`)

**Entornos:**
- `staging`: tareas 2×, scale-down por agenda fuera de horario
- `production`: tareas 2× mínimo, auto-scaling 2-6 según CPU

---

## 1. Acceso Inicial

### 1.1. Verificar identidad AWS

```bash
aws sts get-caller-identity
# Debe retornar un IAM user/role con permisos para ECS, ECR, S3, SSM
```

### 1.2. Configurar perfil (opcional)

```bash
aws configure sso --profile sge-prod
export AWS_PROFILE=sge-prod
```

---

## 2. Deploy

### 2.1. Construir y subir imagen Docker

```bash
# Variables
export AWS_REGION=us-east-2
export ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/sge"
export VERSION="v1.0.0"  # o número de release

# Login a ECR
aws ecr get-login-password --region ${AWS_REGION} | \
  docker login --username AWS --password-stdin ${ECR_URI}

# Build + tag
docker build -t sge:${VERSION} .

# Tag con latest + specific
docker tag sge:${VERSION} ${ECR_URI}/production:${VERSION}
docker tag sge:${VERSION} ${ECR_URI}/production:latest

# Push
docker push ${ECR_URI}/production:${VERSION}
docker push ${ECR_URI}/production:latest
```

### 2.2. Migración de Prisma (si hay schema change)

```bash
# Opción A: en CI/CD antes de task definition nueva
DATABASE_URL=$(aws ssm get-parameter --name /sge/production/database-url --with-decryption --query 'Parameter.Value' --output text) \
  npx prisma migrate deploy
```

**Importante:** Las migraciones deben ser compatibles hacia atrás mientras coexisten 2 tasks (rolling deploy). Para breaking changes, mantener 2 entornos activos o usar feature flags.

### 2.3. Aplicar cambios de Terraform

```bash
cd infra/terraform

# Ver plan
terraform plan -var="container_image=${ECR_URI}/production:${VERSION}" -out=plan.tfplan

# Aplicar
terraform apply plan.tfplan
```

**Output clave:** `alb_dns_name` (URL de entrada del ALB).

### 2.4. Forzar nuevo deploy sin cambio de imagen

Si solo cambia configuración (env vars, secrets):

```bash
aws ecs update-service \
  --cluster sge-production-cluster \
  --service sge-production-service \
  --force-new-deployment
```

---

## 3. Rollback

### 3.1. Re-deploy versión anterior

```bash
# Sin destruir infra, solo cambiar imagen
terraform apply \
  -var="container_image=${ECR_URI}/production:v0.9.0"
```

### 3.2. Rollback de migración Prisma

Si la nueva versión introdujo migración incompatible:

```bash
# 1) Identificar última migración aplicada
psql "${DATABASE_URL}" -c 'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;'

# 2) Aplicar SQL de rollback manualmente (escribir `down.sql` por migración)
psql "${DATABASE_URL}" < infra/prisma-rollbacks/20260713010000_down.sql

# 3) Marcar como rolled back en la tabla (opcional)
psql "${DATABASE_URL}" -c "DELETE FROM _prisma_migrations WHERE migration_name='20260713010000_oficio_status_enum';"

# 4) Re-deploy versión anterior (paso 3.1)
```

---

## 4. Monitoreo y Alertas

### 4.1. Health Check

```bash
curl https://${ALB_DNS}/api/health
```

Debe retornar `{"status":"ok",...}` con código 200. El target group ejecuta este check cada 30s; tareas unhealthy se reemplazan automáticamente.

### 4.2. Métricas CloudWatch clave

| Métrica | Umbral alerta |
|---|---|
| `ECSServiceAverageCPUUtilization` | >80% por 5 min → scale-up |
| `ECSServiceAverageMemoryUtilization` | >85% por 5 min |
| `TargetResponseTime` (ALB) | p95 >1.5s por 5 min |
| `HTTPCode_Target_5XX_Count` | >5 errores/min |
| `UnHealthyHostCount` (target group) | >0 por 2 min |

### 4.3. Logs

```bash
# Logs en vivo de la tarea
aws logs tail /ecs/sge-production/app --follow

# Solo errores
aws logs tail /ecs/sge-production/app --filter-pattern 'ERROR' --since 1h
```

### 4.4. Investigación de incidente

```bash
# 1. Listar tareas en ejecución
aws ecs list-tasks --cluster sge-production-cluster --service-name sge-production-service

# 2. Inspeccionar una tarea
aws ecs describe-tasks --cluster sge-production-cluster --tasks <TASK_ARN>

# 3. Logs de esa tarea específica
aws logs get-log-events \
  --log-group-name /ecs/sge-production/app \
  --log-stream-name ecs/sge-app/<TASK_ID>

# 4. Ver eventos recientes del servicio (deploy failures, etc.)
aws ecs describe-services \
  --cluster sge-production-cluster \
  --services sge-production-service \
  --query 'services[0].events[0:10]'
```

---

## 5. Backups

### 5.1. PostgreSQL (Neon)

Neon ofrece **Point-in-Time Recovery (PITR) de 7 días**.

- **Automático**: continuo, sin acción manual.
- **Restore a point-in-time**: contactar soporte Neon con timestamp objetivo.

### 5.2. Archivos S3

- Versionado activado: cada PUT genera nueva versión.
- Lifecycle: versiones >30 días → GLACIER (90 días desde creación).
- Retención total: 7 años (cumple ISO 27001 A.8.13).

#### Restore de archivo eliminado

```bash
# 1. Listar versiones
aws s3api list-object-versions \
  --bucket sge-production-uploads-XXXXX \
  --prefix oficios/2026/07/

# 2. Descargar versión específica
aws s3api get-object \
  --bucket sge-production-uploads-XXXXX \
  --key oficios/2026/07/memo.pdf \
  --version-id <VERSION_ID> \
  /tmp/memo.pdf
```

---

## 6. Secret Rotation

### 6.1. Rotar `JWT_SECRET`

```bash
# 1. Generar nuevo
NEW_SECRET=$(openssl rand -base64 48)

# 2. Actualizar en SSM
aws ssm put-parameter \
  --name /sge/production/jwt-secret \
  --value "${NEW_SECRET}" \
  --type SecureString \
  --overwrite

# 3. Forzar reload de secrets (nueva task)
aws ecs update-service \
  --cluster sge-production-cluster \
  --service sge-production-service \
  --force-new-deployment
```

**Impacto:** Todas las sesiones JWT existentes quedan inválidas (usuarios deben re-login). Programar en horario de baja actividad.

### 6.2. Rotar `DATABASE_URL` (credenciales Neon)

```bash
# 1. Crear nuevo branch/role en Neon
# 2. Actualizar cadena pooled:
NEW_URL="postgresql://..."

aws ssm put-parameter \
  --name /sge/production/database-url \
  --value "${NEW_URL}" \
  --type SecureString \
  --overwrite

# 3. Force redeploy
aws ecs update-service ... --force-new-deployment
```

---

## 7. Incidentes Comunes

### 7.1. Servicio Unhealthy (target group en rojo)

**Síntomas:** ALB reporta `UnHealthyHostCount > 0`, smoke test falla.

**Diagnóstico:**
```bash
aws ecs describe-services --cluster sge-production-cluster \
  --services sge-production-service \
  --query 'services[0].deployments'
```

**Causas típicas:**
1. Migración Prisma pendiente → ver logs, ejecutar `prisma migrate deploy`.
2. SSM parameter inaccesible → verificar permisos IAM del role de task.
3. Secret expirado/inválido → ver `aws ssm get-parameter-history`.
4. Imagen Docker no se pull-ea → ECR auth expirado, re-login.

**Resolución:**
```bash
# Forzar nuevo deploy (pull imagen fresca)
aws ecs update-service --cluster sge-production-cluster \
  --service sge-production-service --force-new-deployment
```

### 7.2. CPU alto sostenido

```bash
# Ver procesos (necesita exec en la tarea)
aws ecs execute-command \
  --cluster sge-production-cluster \
  --task <TASK_ARN> \
  --container sge-app \
  --command "/bin/sh" \
  --interactive
```

Si hay queries lentos, identificar por IDOR helper o Prisma raw.

### 7.3. Disco lleno en task

Los tasks Fargate no tienen almacenamiento persistente. Logs van a CloudWatch. Si CloudWatch quota llena, ajustar `retention_in_days` o pasar a S3.

---

## 8. Contactos y Escalación

| Nivel | Contacto | SLA |
|---|---|---|
| L1 (operacional) | on-call sre@sge.empresa | 1h |
| L2 (infra AWS) | platform-team@sge.empresa | 4h |
| L3 (vendor: Neon) | soporte@neon.tech | 24h |
| Seguridad | security@sge.empresa | Inmediato |

---

## 9. Compliance Checklist Mensual

- [ ] Revisar `audit-records` exportando a S3 inmutable
- [ ] Verificar rotación de secretos (no >180 días)
- [ ] Revisar `UnHealthyHostCount` histórico
- [ ] Validar backups Neon con restore en staging
- [ ] Revisar costos AWS vs presupuesto
- [ ] Actualizar dependencias (Renovate/Dependabot)
- [ ] `npm audit --production` para vulnerabilidades críticas

---

**Anexo:** Ver `infra/terraform/README.md` para IaC y `docs/06-implementacion/` para despliegues manuales previos.
