# Migraciones Prisma

## Baseline inicial

Migración generada el 13 jul 2026 como punto de partida para `prisma migrate deploy` en producción. Reemplaza el flujo previo de `prisma db push` (solo dev).

## Aplicar en producción

```bash
npx prisma migrate deploy
```

Esto lee la carpeta `prisma/migrations/` en orden lexicográfico y aplica solo las que no están registradas en la tabla `_prisma_migrations`.

## Crear una nueva migración

1. Modificar `prisma/schema.prisma`
2. `npx prisma migrate dev --name <descripcion_clara>`
3. Revisar el SQL generado en `prisma/migrations/<timestamp>_<name>/migration.sql`
4. Commit del cambio

## En desarrollo

Migración local (crea + aplica + regenera cliente):

```bash
npx prisma migrate dev
```

Solo regenerar cliente (sin tocar DB):

```bash
npx prisma generate
```
