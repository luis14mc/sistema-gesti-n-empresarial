# Estrategia de entornos

## Separación

| Entorno | `APP_ENV` | Datos | Storage | Cookies | Despliegue |
| --- | --- | --- | --- | --- | --- |
| Desarrollo | `development` | PostgreSQL local dedicado | Local o MinIO | HTTP permitido | Host o Compose |
| Pruebas | `test` | Base efímera por ejecución | Namespace de prueba | HTTP permitido | CI |
| Staging | `staging` | Base administrada independiente | Bucket independiente | Secure/HTTPS | CD de staging, pendiente 5C |
| Producción | `production` | Base administrada de producción | Bucket independiente | Secure/HTTPS | Aprobación protegida, pendiente 5C |

No se permite usar datos de producción directamente en desarrollo o CI. Staging y producción rechazan storage local, endpoints S3 personalizados y credenciales AWS estáticas.

## Validación

`src/platform/config/env.ts` mantiene contratos separados para configuración pública, servidor, storage y worker. `src/instrumentation.ts` valida el servidor al arrancar el runtime Node. Los errores enumeran nombres de variables, nunca valores.

Variables obligatorias en staging/producción:

- `NODE_ENV=production`
- `APP_ENV`
- `DATABASE_URL`
- `APP_URL` HTTPS
- `JWT_SECRET` de al menos 32 caracteres
- `COOKIE_SECURE=true`
- `STORAGE_DRIVER=s3`
- `S3_BUCKET`
- `AWS_REGION`
- `PUPPETEER_EXECUTABLE_PATH` cuando el motor PDF es obligatorio (`/opt/chrome/chrome` en la imagen)

ECS debe obtener credenciales mediante IAM task roles. `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` y `AWS_SESSION_TOKEN` se reservan para emuladores o pruebas locales.

## Presupuestos de conexión iniciales

`DATABASE_POOL_MAX` limita cada proceso a 10 conexiones por defecto. El presupuesto total se calcula como:

```text
(réplicas web + réplicas worker + tareas operativas) * DATABASE_POOL_MAX
```

El valor debe permanecer por debajo del límite del pooler dejando capacidad para migraciones, administración y recuperación. Se medirá antes de aumentar réplicas.

## Inventario auditado

- Objetivo declarado: ECS Fargate, Neon PostgreSQL, S3, ALB, SSM y CloudWatch.
- CI existente: npm/Node 20 sin PostgreSQL ni migraciones; se reemplazará en 5B.
- Terraform existente: borrador monolítico sin estado remoto separado, worker, TLS o alarmas; se abordará en 5D.
- Worker real: ausente. Solo existen dispatcher síncrono, outbox y ejecución de reportes sin procesador.
- Health anterior: combinaba liveness/readiness y exponía errores internos.
- Backups: documentación sin automatización ni evidencia de restauración.
- Rollback/CD/staging: no implementados todavía.
- Storage anterior: exigía claves AWS estáticas y el perfil MinIO no estaba conectado.

## Limitaciones de 5A

- La autenticación principal todavía persiste un JWT accesible a JavaScript; se corregirá en endurecimiento operacional/seguridad.
- La configuración institucional aún usa filesystem local y no es apta para múltiples réplicas.
- Algunos flujos legacy usan prefijos storage no tenant-scoped; S3 protegido los rechaza en lugar de crear objetos inseguros.
- No existe identidad ni procesador durable de worker.
