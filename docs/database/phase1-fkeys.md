# Fase 1 — FKs `*ById` (N5 aditivo)

Migración: `20261015162000_phase1_indexes_and_fkeys`.

Tras el deploy, en staging/producción ejecutar (solo lectura) para detectar huérfanos si alguna constraint quedó `NOT VALID`:

```sql
SELECT 'payslips.generatedById' AS fk, COUNT(*) AS orphans
FROM payslips p LEFT JOIN users u ON u.id = p."generatedById" WHERE u.id IS NULL
UNION ALL
SELECT 'payroll_settings.updatedById', COUNT(*)
FROM payroll_settings p LEFT JOIN users u ON u.id = p."updatedById"
WHERE p."updatedById" IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'equipment_history.performedById', COUNT(*)
FROM equipment_history h LEFT JOIN users u ON u.id = h."performedById"
WHERE h."performedById" IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'equipment_maintenances.performedById', COUNT(*)
FROM equipment_maintenances m LEFT JOIN users u ON u.id = m."performedById"
WHERE m."performedById" IS NOT NULL AND u.id IS NULL
UNION ALL
SELECT 'software_subscriptions.createdById', COUNT(*)
FROM software_subscriptions s LEFT JOIN users u ON u.id = s."createdById" WHERE u.id IS NULL
UNION ALL
SELECT 'software_subscriptions.updatedById', COUNT(*)
FROM software_subscriptions s LEFT JOIN users u ON u.id = s."updatedById"
WHERE s."updatedById" IS NOT NULL AND u.id IS NULL;
```

Si `orphans > 0`, corregir datos antes de `VALIDATE CONSTRAINT`. Documentar el conteo en el PR de fase 1.
