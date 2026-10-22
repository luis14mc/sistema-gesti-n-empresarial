# Checklist de puesta en producción (Railway + R2)

Use este checklist antes de declarar **producción lista** o antes de una entrega formal.

## Railway — aplicación

- [ ] Servicio web en Railway con **deploy verde** desde rama `main`.
- [ ] `APP_ENV=production`, `NODE_ENV=production`, `APP_URL` con HTTPS público.
- [ ] `JWT_SECRET` ≥ 32 caracteres, **distinto** a desarrollo/staging.
- [ ] `COOKIE_SECURE=true` en producción.
- [ ] Health check responde (URL pública carga login o redirect esperado).

## Railway — PostgreSQL

- [ ] `DATABASE_URL` (y `DIRECT_URL` si aplica) apuntan al servicio Postgres del proyecto.
- [ ] **Backup automático** activo; backup manual reciente antes de migraciones ([runbook-backups-railway.md](./runbook-backups-railway.md)).
- [ ] `pnpm prisma migrate deploy` ejecutado en predeploy sin error (ver scripts Railway).
- [ ] Conteos de smoke con `scripts/db/inventory-counts.sql` registrados post-deploy.

## Cloudflare R2 (archivos)

- [ ] `STORAGE_DRIVER=s3` con `S3_ENDPOINT` R2 y bucket dedicado producción.
- [ ] Credenciales R2 (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` en Railway) **rotadas** y no en el repositorio.
- [ ] Prueba de subida: oficio adjunto, acta de equipo o PDF de compra en entorno staging.

## Seguridad y calidad

- [ ] Sin secretos en variables `NEXT_PUBLIC_*`.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` verdes en commit desplegado.
- [ ] Dependencias: revisión `pnpm audit` (sin críticas abiertas sin plan).
- [ ] Auditoría **2026-10-19** cerrada; items bloqueantes resueltos o documentados como posentrega.

## PDF y worker (si aplica)

- [ ] Chromium disponible en imagen (`PUPPETEER_EXECUTABLE_PATH`) si generación PDF está activa.
- [ ] Worker/cola (si se usa en Railway) desplegado y consumiendo jobs.

## Documentación y operación

- [ ] [acta-entrega.md](./acta-entrega.md) y [pruebas-aceptacion-usuarios.md](../05-pruebas/pruebas-aceptacion-usuarios.md) completados por negocio.
- [ ] Runbook de backups probado al menos una vez en base **no productiva**.

## Posentrega (no bloquean go-live)

- [ ] Normalización de esquema BD (`chore/db-normalization-*`) planificada post-entrega.
- [ ] Microsoft Graph / correo institucional avanzado.
- [ ] Incluir `pnpm` completo en imagen si se requiere diagnóstico en contenedor.
- [ ] Afinar rate limit / IP real detrás del proxy Railway.
