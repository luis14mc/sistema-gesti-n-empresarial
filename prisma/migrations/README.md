# Migraciones Prisma

## Baseline inicial

Migración generada el 13 jul 2026 como punto de partida para `prisma migrate deploy` en producción. Reemplaza el flujo previo de `prisma db push` (solo dev).

## Aplicar en producción

```bash
npx prisma migrate deploy
```

Esto lee la carpeta `prisma/migrations/` en orden lexicográfico y aplica solo las que no están registradas en la tabla `_prisma_migrations`.

## Crear una nueva migración

1. Modificar el datamodel en `prisma/schema/` (multi-archivo por dominio) según [docs/database/conventions.md](../../docs/database/conventions.md)
2. `npx prisma migrate dev --name <descripcion_clara>`
3. Revisar el SQL generado en `prisma/migrations/<timestamp>_<name>/migration.sql` — preferir SQL **aditivo e idempotente** (`IF NOT EXISTS`); evitar `DROP`/`RENAME` destructivos sin fase previa “dejar de usar” ya en producción
4. Probar en **Railway PR Environment / staging**; incluir SQL + plan de reversión en el PR; respaldo Postgres antes de merge ([docs/deployment/railway.md](../../docs/deployment/railway.md))
5. Commit del cambio

## En desarrollo

Migración local (crea + aplica + regenera cliente):

```bash
npx prisma migrate dev
```

Solo regenerar cliente (sin tocar DB):

```bash
npx prisma generate
```
