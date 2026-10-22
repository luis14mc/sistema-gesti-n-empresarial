# Runbook: backups Postgres en Railway

Procedimiento para **activar**, **verificar**, **restaurar en prueba** y **validar** backups del servicio PostgreSQL en Railway. No incluye credenciales: obténgalas solo desde la consola de Railway o su gestor de secretos.

## 1. Activar y verificar backups

1. Inicie sesión en [Railway](https://railway.app) y abra el **proyecto** del SGE.
2. Seleccione el servicio **PostgreSQL** (no el servicio web).
3. Vaya a la pestaña **Backups** (o **Settings → Backups**, según la UI actual).
4. Confirme que los backups **automáticos** están habilitados y anote la **frecuencia** y **retención** mostradas.
5. Si la UI ofrece **backup manual**, ejecute uno antes de migraciones o entregas importantes y espere estado **Completed**.
6. Verificación mínima: existe al menos un backup reciente cuya fecha sea **posterior** al último despliegue con migración.

> **Responsable:** quien aprueba PRs con migración debe confirmar backup manual (ver [docs/deployment/railway.md](../deployment/railway.md)).

## 2. Restaurar en una base de prueba

**Nunca restaure directamente sobre producción** sin ventana acordada y plan de reversión.

1. Cree un **nuevo servicio Postgres** en Railway (entorno de prueba o proyecto sandbox), o use una base local con `DATABASE_URL` de prueba.
2. En el Postgres **origen** (producción o staging), use **Restore** / **Download backup** según Railway:
   - **Opción A — Restore a nuevo servicio:** Railway crea una instancia clonada; copie la nueva `DATABASE_URL` al entorno de prueba.
   - **Opción B — Export + import:** descargue el dump que proporcione Railway e impórtelo con `psql` o la herramienta indicada en su documentación actual.
3. Apunte la aplicación de **prueba** (PR Environment o local) a la `DATABASE_URL` restaurada.
4. Ejecute solo lecturas de smoke: login, listar oficios, una orden de compra, un equipo.

## 3. Validar la restauración (conteos)

Conecte a la base restaurada con un cliente SQL (Railway **Connect**, `psql`, DBeaver, etc.) y ejecute el script de inventario:

```bash
# Ejemplo local (sustituya la URL por la de la base restaurada)
psql "$DATABASE_URL" -f scripts/db/inventory-counts.sql
```

El archivo [`scripts/db/inventory-counts.sql`](../../scripts/db/inventory-counts.sql) devuelve **conteos por tabla** (solo lectura). Compare con un resultado guardado de producción **antes** del incidente, o con el inventario documentado en [docs/database/inventory.md](../database/inventory.md):

| Comprobación | Criterio |
| --- | --- |
| Tablas críticas con filas | `employees`, `users`, `payslips`, `purchase_orders` (o equivalentes activos) > 0 si existían en origen |
| Sin error masivo | Ninguna tabla esperada devuelve NULL por “relation does not exist” tras migraciones |
| Coherencia | Conteos no son drásticamente menores que el último snapshot conocido |

Registre fecha, entorno y conteos en el acta o ticket del ejercicio de restore.

## 4. Rollback de aplicación (recordatorio)

Restaurar la base **no revierte** el código desplegado. Si el incidente fue una migración mala:

1. Restaure o clone la base (pasos anteriores).
2. Redespliegue un **commit anterior** de la app compatible con ese esquema, o aplique el **plan de reversión SQL** del PR.

## 5. Referencias

- Despliegue y regla de migrate: [docs/deployment/railway.md](../deployment/railway.md)
- Convenciones de migración: [docs/database/conventions.md](../database/conventions.md)
