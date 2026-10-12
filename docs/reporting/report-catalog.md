# Catálogo de reportes

El catálogo vive únicamente en `src/modules/reporting/application/services/report-catalog.ts`. Las páginas y rutas consumen esa definición; no mantienen copias locales.

| Código | Módulo | Permiso | Formatos | Disponible |
| --- | --- | --- | --- | --- |
| `DASHBOARD_EXECUTIVE` | Dashboard | `dashboard.executive` | CSV, XLSX | No |
| `PURCHASE_ORDER_SUMMARY` | Compras | `reports.financial.purchases` | CSV, XLSX | **Sí** |
| `PURCHASE_ORDER_TAX_ANALYSIS` | Compras | `reports.financial.purchases` | CSV, XLSX | No |
| `PURCHASE_ORDER_SUPPLIER_ANALYSIS` | Compras | `reports.financial.purchases` | CSV, XLSX | No |
| `OFFICE_REGISTER` | Oficios | `reports.view` | CSV, XLSX | **Sí** |
| `OFFICE_DIRECTION_SUMMARY` | Oficios | `reports.view` | CSV, XLSX | No |
| `EQUIPMENT_INVENTORY` | Equipos | `reports.view` | CSV, XLSX | **Sí** |
| `EQUIPMENT_STATUS_SUMMARY` | Equipos | `reports.view` | CSV, XLSX | No |
| `EQUIPMENT_ASSIGNMENT_HISTORY` | Equipos | `reports.view` | CSV, XLSX | **Sí** |
| `EQUIPMENT_MAINTENANCE_COST` | Equipos | `reports.financial.equipment` | CSV, XLSX | No |
| `EQUIPMENT_DISPOSAL_SUMMARY` | Bajas | `reports.view` | CSV, XLSX | **Sí** |
| `EQUIPMENT_REPLACEMENT_PROJECTION` | Bajas | `reports.financial.equipment` | CSV, XLSX | No |
| `AUDIT_ACTIVITY` | Auditoría institucional | `reports.audit` | CSV, XLSX | No |
| `USER_ACTIVITY` | Usuarios | `reports.audit` | CSV, XLSX | No |
| `SYSTEM_AUDIT_EVENTS` | Auditoría del sistema | `reports.audit` | CSV, XLSX | No |

Todos los reportes requieren un rango de fechas (`from` / `to`, máximo 366 días). La exportación síncrona usa `GET /api/reports/{code}/export?format=csv|xlsx&from=…&to=…` y exige el permiso del catálogo más `reports.export`.

`GET /api/reports/catalog` devuelve solamente entradas con `available: true` autorizadas para el rol de membresía activa.

### Permisos de exportación (roles de organización)

| Permiso | Roles típicos |
| --- | --- |
| `reports.view` + `reports.export` | IT_MANAGER, IT_TECHNICIAN, HR, AUDITOR, DIRECTOR, ADMINISTRACION, OWNER, ADMIN |
| `reports.financial.purchases` + `reports.export` | PROCUREMENT, AUDITOR, ADMINISTRACION, OWNER, ADMIN |
| `reports.financial.equipment` | (reservado; reportes aún no disponibles) |
| `reports.audit` | (reservado; reportes aún no disponibles) |

Los datasets viven en `src/lib/reportes/` (mismo contrato que `src/lib/compras/reportes/purchase-order-export.ts`).
