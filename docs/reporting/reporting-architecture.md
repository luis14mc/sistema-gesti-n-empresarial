# Arquitectura de reportes

## Alcance de la fase 4A

La fase 4A establece el catálogo, permisos, filtros compartidos, contratos de consulta y registro de ejecuciones. No implementa todavía agregados del tablero, exportadores, almacenamiento de exportaciones, trabajos en segundo plano ni caché.

El flujo obligatorio es:

```text
Route handler
  -> contexto autenticado de organización
  -> ReportingQueryService
  -> permiso del catálogo
  -> handler de consulta inyectado
  -> repositorio tenant-scoped
  -> DTO preparado
```

Los componentes React no consultarán tablas ni Prisma. Los handlers reciben `organizationId`, `userId` y `timezone` desde `OrganizationContext`; esos valores no se aceptan desde filtros del cliente.

## Inventario preliminar

### Fuentes canónicas

| Dominio | Fuente |
| --- | --- |
| Compras | `CompraOrden` (`purchase_orders`) y sus valores persistidos |
| Equipos | `Equipment`, `EquipmentAssignment`, `EquipmentMaintenance` |
| Oficios | `Oficio`, manteniendo separados tipo, dirección y estado |
| Bajas | `EquipmentDisposal`, `ReplacementProjection` |
| Auditoría institucional | `Audit`, `AuditFinding`, `CorrectiveAction` |
| Actividad del sistema | `SystemAuditEvent`; `AuditRecord` continúa como fuente transitoria |
| Usuarios de organización | `OrganizationMembership` unido a `User` |

`CompraSolicitud` y las tablas `Legacy` no son fuentes válidas para nuevos reportes.

### Hallazgos que bloquean consultas existentes

- `src/app/dashboard/page.tsx` agrega datos sin filtro de organización.
- `src/app/api/compras/reportes/route.ts` agrega `CompraSolicitud` sin contexto tenant.
- `src/hooks/useDashboard.ts` duplica métricas a partir de primeras páginas incompletas.
- Los reportes de compras repiten conteos ya obtenidos por `groupBy`.
- El dashboard y el reporte de compras carecen de rango de fechas y zona horaria organizacional.
- No existen CSV/XLSX; los PDF actuales se generan sincrónicamente y en memoria.
- Las claves de varias consultas React Query no incluyen organización.
- No existe seguimiento operativo de trabajos, procesador outbox, métricas de aplicación ni separación live/ready.
- El endpoint de salud actual combina liveness y readiness y expone detalles de dependencias.
- La documentación de respaldo describe tareas y restauraciones que no están automatizadas ni verificadas.

### Límites existentes y faltantes

- La paginación varía por módulo; algunos endpoints no limitan `pageSize`.
- La fase 4A limita tablas de reportes a 100 filas por página.
- `REPORT_MAX_RANGE_DAYS` limita rangos personalizados y usa 366 días por defecto.
- Los límites de exportación de 25,000 filas y la decisión síncrono/trabajo se implementarán en 4D y 4E.

## Aislamiento tenant

Cada repositorio de reporte debe construir su predicado con `context.organizationId`. El servicio de consultas reemplaza cualquier zona horaria incluida en datos internos por la zona horaria resuelta desde la organización. Los endpoints normales no pueden ejecutar analítica global.

`reports.platform` existe como capacidad reservada, pero ningún `OrganizationRole` la obtiene. Una identidad de administrador de plataforma deberá diseñarse en 4G antes de habilitar consultas globales.

## Fechas

Las fechas URL usan `AAAA-MM-DD` y representan días civiles de la organización, no días UTC. `parseReportQuery` valida fechas reales, orden, límite, paginación y zona IANA. Los repositorios futuros convertirán esos límites civiles a instantes de base de datos únicamente en su borde de persistencia.

## Ejecuciones

`ReportExecution` registra organización, solicitante, código, formato, filtros canónicos, estado, filas, duración, request ID y referencia privada de almacenamiento. Una llave foránea compuesta exige que el solicitante sea miembro de la organización registrada. El modelo no concede acceso al objeto almacenado; 4D agregará endpoints autenticados y expiración.

## Índices

La fase 4A agrega solamente:

| Consulta | Índice | Beneficio | Costo de escritura |
| --- | --- | --- | --- |
| Historial por organización y reporte | `(organizationId, reportCode, createdAt)` | Lista y diagnóstico tenant-scoped | Un índice por ejecución |
| Historial solicitado por usuario en una organización | `(organizationId, userId, createdAt)` | Auditoría tenant-scoped del solicitante | Un índice por ejecución |

Los índices de agregados de módulos se decidirán en 4B/4C después de implementar las consultas y medir planes con datos representativos.

## Limitaciones conocidas

- No hay handlers de reportes productivos en 4A.
- No se ha sustituido aún el dashboard o reporte de compras inseguro existente.
- No existe identidad de administrador de plataforma separada.
- No hay conversión SQL de límites de día por zona horaria hasta que existan consultas concretas.
- No hay mediciones de rendimiento porque esta subfase no ejecuta agregados.
