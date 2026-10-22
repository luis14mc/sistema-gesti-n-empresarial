# Despliegue en Railway

Railway ejecuta la aplicación en contenedores sin roles IAM de AWS. El almacenamiento durable debe ser **Cloudflare R2** (API S3-compatible) con credenciales de acceso explícitas.

## Regla de despliegue (obligatoria)

**Todo merge a `main` se despliega a producción** y el pipeline ejecuta `prisma migrate deploy` contra la base Postgres de producción (ver [deploy/railway/railway-predeploy.sh](../../deploy/railway/railway-predeploy.sh) / [deploy/railway/railway-start.sh](../../deploy/railway/railway-start.sh)).

### PRs con migración (`prisma/migrations/*`)

1. **Probar primero** en el **PR Environment / staging** de Railway (misma secuencia: build → `migrate deploy` → app). No mergear sin deploy verde en staging con la migración incluida.
2. **Descripción del PR** (obligatorio): SQL generado (`prisma migrate diff` o contenido de `migration.sql`) y **plan de reversión** (pasos/SQL inverso, datos afectados). Ver también [docs/database/conventions.md](../database/conventions.md).
3. **Antes de aprobar:** respaldo manual en Railway — servicio **Postgres → Backups** (snapshot/export según la UI de Railway). Quien aprueba confirma que el backup existe.

### SQL de migración

- Preferir cambios **aditivos** e **idempotentes** donde aplique (`CREATE … IF NOT EXISTS`, `ADD VALUE IF NOT EXISTS`, bloques `DO $$ … IF NOT EXISTS`).
- **Nada destructivo** (`DROP TABLE/COLUMN`, `RENAME` que rompa lectores, `NOT NULL` sin backfill) sin una fase previa ya desplegada en la que el código **dejó de usar** el objeto (expandir → migrar datos → contraer en PRs separados).

### PRs sin migración

No deben cambiar el SQL desplegado; validar con `scripts/db/check-drift.sh` en CI cuando corresponda.

## Variables por ambiente

| Variable | Staging | Producción | Notas |
| --- | --- | --- | --- |
| `NODE_ENV` | `production` | `production` | Obligatorio |
| `APP_ENV` | `staging` | `production` | Obligatorio |
| `DATABASE_URL` | PostgreSQL Railway | PostgreSQL Railway | Obligatorio |
| `APP_URL` | HTTPS del servicio | HTTPS del servicio | Obligatorio |
| `JWT_SECRET` | ≥ 32 caracteres | ≥ 32 caracteres | Obligatorio |
| `COOKIE_SECURE` | `true` | `true` | Obligatorio |
| `STORAGE_DRIVER` | `s3` | `s3` | Obligatorio |
| `S3_BUCKET` | ver convención | ver convención | Obligatorio |
| `S3_ENDPOINT` | `https://<account>.r2.cloudflarestorage.com` | igual | Obligatorio en Railway |
| `AWS_REGION` | `auto` | `auto` | R2 usa región `auto` en el SDK |
| `AWS_ACCESS_KEY_ID` | token R2 | token R2 | Obligatorio con `S3_ENDPOINT` |
| `AWS_SECRET_ACCESS_KEY` | secreto R2 | secreto R2 | Obligatorio con `S3_ENDPOINT` |
| `PUPPETEER_EXECUTABLE_PATH` | `/usr/bin/chromium` | `/usr/bin/chromium` | Si `PDF_ENGINE_REQUIRED=true` |
| `PUPPETEER_DISABLE_SANDBOX` | `true` | `true` | Chromium en contenedor no root |

No definir `S3_PUBLIC_URL`: el bucket del SGE es privado; las descargas usan URLs firmadas o rutas API autenticadas.

## Convención de buckets R2

- Producción: `cni-<app>-files` (ejemplo: `cni-sge-files`)
- Staging: `cni-<app>-files-staging` (ejemplo: `cni-sge-files-staging`)

Cada objeto se guarda bajo el prefijo `{APP_ENV}/organizations/{organizationId}/…` para aislamiento por tenant.

## Comprobaciones

- **Readiness:** `GET /api/health/ready` incluye `components.storage: ok|degraded` (HeadBucket). Un fallo de storage no devuelve 503 por sí solo.
- **Smoke manual:** desde el servicio Railway, `railway run pnpm storage:smoke` sube, lee, firma y borra un archivo de prueba.

## Flujos que usan storage

Órdenes de compra (PDF y adjuntos), oficios, equipos (actas y documentos), bajas de equipo y dictámenes PDF usan `getStorage()` con claves tenant-scoped. El logo institucional de compras sigue en `public/uploads/institution` en despliegues que no migren el logo a R2; los PDF embeben el logo vía data URI o assets públicos estáticos (`/Logo_CNI.png`).
