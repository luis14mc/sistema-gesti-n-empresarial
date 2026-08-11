# Contenedores

## Artefactos

El Dockerfile usa Node 22.14.0 para dependencias/build, pnpm 9.15.9 y el runtime oficial Puppeteer 25.3.0 fijado por digest (Node 24.18.0 + Chrome 150.0.7871.24):

- `dependencies`: instalación con lockfile congelado y sin descarga de navegador.
- `builder`: Prisma Client, Next.js standalone y bundle ESM del host worker.
- `migration`: Prisma CLI y migraciones para una ejecución controlada.
- `runtime`: servidor standalone no root, Chrome compatible, fuentes y `dumb-init`.

El contexto excluye `.env`, uploads, pruebas, documentación, infraestructura, cachés y datos locales. La imagen runtime no contiene toolchain de desarrollo ni archivos subidos.

## Comandos

```bash
docker build -t sge-web .
docker build --target migration -t sge-migration .
docker compose --profile db up -d db
docker compose --profile storage up -d minio minio-init
docker compose --profile full up --build
```

El perfil local publica `sge-development` en modo de descarga y usa `S3_PUBLIC_URL=http://localhost:9000/sge-development` para que el navegador pueda resolver adjuntos. Esta excepción existe solo para desarrollo; staging y producción mantienen buckets privados y descargas autenticadas.

El target web ejecuta `node server.js`. La migración debe completar antes de habilitar tráfico. Web y migración nunca compiten por aplicar el esquema.

`pnpm start:worker` y `dist/worker/index.js` son entradas explícitas, pero el host falla de forma segura con `BACKGROUND_JOB_PROCESSOR_NOT_IMPLEMENTED`: el repositorio auditado no tiene `BackgroundJob`, claims atómicos ni leases. No despliegue el servicio worker hasta completar esa dependencia.

## Chromium

El navegador y el paquete runtime proceden de la imagen oficial versionada de Puppeteer. Chrome se copia a `/opt/chrome`, se verifica durante el build y el paquete se expone mediante `NODE_PATH=/home/pptruser/node_modules` porque el trazado standalone no conserva su enlace raíz. El runtime no depende de cachés del host o del desarrollador.

Sandboxing permanece habilitado por defecto en código. La validación real del contenedor sin capacidades elevadas mostró que Chrome requiere `PUPPETEER_DISABLE_SANDBOX=true`; Compose lo declara explícitamente. ECS/Fargate debe documentar y aprobar la misma reducción de aislamiento, limitar PDF a contenido confiable y mantener el proceso no root.

Readiness verifica de forma ligera que el ejecutable exista y sea ejecutable; no genera un PDF en cada petición. Una prueba de lanzamiento real del contenedor forma parte de la validación de imagen.

## Health

- `/api/health/live`: solo confirma que el proceso responde; Docker lo usa para evitar reinicios por fallas externas.
- `/api/health/ready`: valida configuración, base/migraciones, storage y disponibilidad del ejecutable PDF con timeout.

El ALB debe usar readiness. Las respuestas públicas solo incluyen `ok` o `unavailable`, sin errores, hosts ni credenciales.

## Storage local

Storage local se permite únicamente en desarrollo/pruebas y usa `LOCAL_STORAGE_PATH=./public`. El adaptador crea `uploads/{APP_ENV}` y rechaza traversal. Staging y producción requieren S3 privado con prefijo físico de ambiente y prefijo lógico de organización.
