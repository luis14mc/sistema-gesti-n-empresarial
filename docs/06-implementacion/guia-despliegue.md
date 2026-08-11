# Guía de despliegue

La arquitectura objetivo usa contenedores compatibles con ECS Fargate, PostgreSQL administrado y S3 privado. Los procedimientos controlados de staging, producción y rollback se completarán en las fases 5C y 5D.

## Requisitos

- Node.js 22.14.0 para el artefacto de producción.
- pnpm 9.15.9 mediante Corepack.
- PostgreSQL con conexión directa separada para migraciones.
- Configuración válida según `docs/deployment/environments.md`.

## Validación local

```bash
pnpm install --frozen-lockfile
pnpm prisma validate
pnpm prisma generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
docker build .
```

## Migraciones

Las migraciones se ejecutan una vez mediante el target `migration`, nunca desde cada réplica web:

```bash
docker build --target migration -t sge-migration .
docker run --rm --env-file /ruta/segura/runtime.env sge-migration
```

No use `prisma db push` ni `prisma migrate reset` durante un despliegue.

## Inicio

El target predeterminado inicia `node server.js` sobre la salida standalone. La activación del worker está bloqueada hasta implementar el procesador durable con claims y leases; consulte `docs/deployment/docker.md`.
