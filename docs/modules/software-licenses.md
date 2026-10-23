# Licencias de software

## Conceptos (UI)

| Concepto | Tabla | Etiqueta en pantalla |
|----------|-------|----------------------|
| Suscripción | `software_subscriptions` | Contrato (producto, plan, cantidad contratada, ciclo, costo, renovación) |
| Licencia | `software_license_seats` | **Licencia** (nunca “asiento”) |
| Asignación | `software_license_assignments` | Usuario vinculado a una licencia |

## Tipos de licencia (`seatType`)

- **INDIVIDUAL** — Cuenta personal: requiere `accountEmail`; máximo **1** asignación activa. Segunda asignación → `409 LICENSE_ALREADY_ASSIGNED`; usar **Reasignar** (`replaceAssignmentId`).
- **SHARED** — Cuenta compartida: requiere `accountEmail`; N asignaciones activas.
- **DEVICE** — Clave / instalación: requiere `equipmentId`; `licenseKey` opcional; empleado opcional (informativo).

Cambiar de tipo solo por edición explícita y respetando reglas (`canChangeSeatTypeTo`).

## Estado derivado

No escribir `ASSIGNED`/`AVAILABLE` en asignar/desasignar. El campo `status` en BD solo para `SUSPENDED`, `CANCELLED` y `AVAILABLE` neutro.

Estado mostrado:

- Suspendida / Cancelada → valor guardado.
- En uso → asignación activa o `equipmentId` en DEVICE.
- Libre → resto.

## Contrato vs registradas

- `totalSeats` = cantidad **contratada** (no crea filas vacías al crear/editar suscripción).
- Las licencias se registran con “Agregar licencia”.
- Métricas: Contratadas / Registradas / En uso / Libres.
- Si registradas > contratadas → advertencia “Excede lo contratado” (no bloquea).

## Clave de licencia

- Almacenada en `licenseKey`.
- API GET enmascara (últimos 5 caracteres).
- “Mostrar” (`POST .../reveal-key`) requiere `software-licenses.update` y audita `LICENSE_KEY_REVEALED`.
- No registrar en logs.

## Renovación

`POST /api/software-licenses/[id]/renew`: avanza `renewalDate` (MONTHLY +1 mes, QUARTERLY +3, ANNUAL +1 año; OTHER exige fecha). Opcional nuevo monto; audita anterior/nuevo.

## Baja de equipo

Al aprobar dictamen de baja, licencias DEVICE del equipo quedan libres (`equipmentId = null`) con auditoría.

## Limpieza de datos

`scripts/licenses/cleanup-empty-seats.ts` — dry-run por defecto; `--confirm` marca `CANCELLED` filas sin cuenta, clave, equipo ni historial. No borra.

## Permisos

Sin cambios: `software-licenses.read`, `.update`, `.manage`, `.assign`, etc. Empleados: licencias en assets solo con `software-licenses.read`. Desactivar empleado: `EMPLOYEE_HAS_ACTIVE_ASSETS` por asignaciones INDIVIDUAL/SHARED (DEVICE no cuenta).
