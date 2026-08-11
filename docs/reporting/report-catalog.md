# Catálogo de reportes

El catálogo vive únicamente en `src/modules/reporting/application/services/report-catalog.ts`. Las páginas y rutas consumen esa definición; no mantienen copias locales.

| Código | Módulo | Permiso | Formatos |
| --- | --- | --- | --- |
| `DASHBOARD_EXECUTIVE` | Dashboard | `dashboard.executive` | XLSX, PDF |
| `PURCHASE_ORDER_SUMMARY` | Compras | `reports.financial.purchases` | CSV, XLSX, PDF |
| `PURCHASE_ORDER_TAX_ANALYSIS` | Compras | `reports.financial.purchases` | CSV, XLSX, PDF |
| `PURCHASE_ORDER_SUPPLIER_ANALYSIS` | Compras | `reports.financial.purchases` | CSV, XLSX, PDF |
| `OFFICE_REGISTER` | Oficios | `reports.view` | CSV, XLSX, PDF |
| `OFFICE_DIRECTION_SUMMARY` | Oficios | `reports.view` | XLSX, PDF |
| `EQUIPMENT_INVENTORY` | Equipos | `reports.view` | CSV, XLSX, PDF |
| `EQUIPMENT_STATUS_SUMMARY` | Equipos | `reports.view` | XLSX, PDF |
| `EQUIPMENT_ASSIGNMENT_HISTORY` | Equipos | `reports.view` | CSV, XLSX |
| `EQUIPMENT_MAINTENANCE_COST` | Equipos | `reports.financial.equipment` | CSV, XLSX, PDF |
| `EQUIPMENT_DISPOSAL_SUMMARY` | Bajas | `reports.view` | CSV, XLSX, PDF |
| `EQUIPMENT_REPLACEMENT_PROJECTION` | Bajas | `reports.financial.equipment` | CSV, XLSX, PDF |
| `AUDIT_ACTIVITY` | Auditoría institucional | `reports.audit` | CSV, XLSX, PDF |
| `USER_ACTIVITY` | Usuarios | `reports.audit` | CSV, XLSX |
| `SYSTEM_AUDIT_EVENTS` | Auditoría del sistema | `reports.audit` | CSV, XLSX |

Todos los reportes requieren un rango de fechas. Los reportes financieros y de auditoría requieren permisos reforzados. `GET /api/reports/catalog` devuelve solamente definiciones autorizadas para el rol de membresía de la organización activa.
