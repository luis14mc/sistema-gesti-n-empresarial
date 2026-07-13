# Manual de Usuario — SGE v1.0.0

> **Sistema de Gestión Empresarial** · 13 jul 2026

---

## 1. Acceso al sistema

### Iniciar sesión

1. Abra su navegador en `https://sge.empresa.com` (URL configurable).
2. Ingrese su **email** y **contraseña** proporcionados por RRHH.
3. Marque "Recordarme" (opcional) si confía en el dispositivo.

> Primer login con credenciales de desarrollo: `admin@empresa.com` / `password123`

### Cambiar contraseña

Una vez autenticado, vaya a **Ajustes** (esquina inferior del menú lateral):

1. Sección "Cambiar contraseña"
2. Ingrese contraseña actual
3. Ingrese nueva contraseña (mínimo 8 caracteres)
4. Confirme la nueva contraseña
5. Click en "Cambiar contraseña"

> El cambio invalida sesiones en otros dispositivos. Re-login requerido allí.

### Editar perfil

En **Ajustes** → sección "Tu perfil":

1. Modifique nombre, apellido, email o teléfono.
2. Click en "Guardar cambios".

> El **rol** y **número de empleado** son administrados por RRHH, no son editables desde aquí.

### Cerrar sesión

Click en su avatar (esquina inferior del sidebar) → "Cerrar sesión".

---

## 2. Roles y permisos

| Rol | Módulos accesibles | Capacidades |
|---|---|---|
| **ADMIN** | Todos | CRUD completo |
| **IT** | Dashboard, Equipos, Asignaciones, Empleados, Compras | Gestión técnica |
| **RRHH** | Dashboard, Usuarios, Empleados, Oficios, Compras | Gestión personal |
| **USER** | Dashboard, Equipos (ver), Oficios (ver), Asignaciones (las propias) | Lectura personal |

---

## 3. Módulos

### 3.1. Dashboard

Vista central con estadísticas rápidas:
- Oficios pendientes, equipos totales, compras activas
- Accesos directos a módulos según su rol
- Registros recientes

### 3.2. Oficios (CNI / Despacho / Internos)

Tres sub-vistas oficiales con numeración automática:

| Scope | Tipos | Numeración |
|---|---|---|
| `/oficios/cni` | INCOMING, OUTGOING | `0001-CNI-2026` |
| `/oficios/despacho` | INCOMING, OUTGOING | `DPICP-0001-2026` |
| `/oficios/internos` | INTERNAL_MEMO | `MEMO-0001-2026` |

**Crear oficio:**
1. Click "+ Nuevo oficio"
2. Complete subject, recipient, institución
3. Adjunte PDF obligatorio (JPG/PNG/PDF, máx 10MB)
4. Click "Guardar"

> Oficios INCOMING (recibidos) no generan número propio: conservan el número del remitente externo.

### 3.3. Equipos / Asignaciones

**Ver inventario:**
- `/equipment` muestra el catálogo con código asset (ej: `TI-LAP-0001`)
- Filtros: categoría, estado, búsqueda libre

**Asignar equipo:**
1. Click "Asignar" sobre el equipo deseado
2. Seleccione empleado (auto-rellena depto/posición)
3. Suba acta de entrega en PDF
4. Click "Confirmar"

**Devolver:**
1. Click "Devolver" sobre la asignación activa
2. Seleccione condición y motivo
3. Suba acta de devolución
4. Click "Confirmar"

**Swap** (intercambio entre usuarios): `/assignments` → botón "Swap"

### 3.4. Empleados

CRUD completo de empleados con:
- Código (auto)
- Nombre, apellido, email, teléfono
- Departamento y puesto (snapshots al asignar equipos)
- Estado activo/inactivo

### 3.5. Compras

Registro de solicitudes con flujo de aprobación:
1. Estado inicial: `DRAFT`
2. Modificar a `IN_PROCESS` al aprobar
3. `COMPLETED` al recibir
4. `CANCELLED` si se anula (soft delete)

### 3.6. Auditoría (solo ADMIN)

`/audit/logs` muestra todos los eventos del sistema:
- Filtros: módulo, categoría, búsqueda libre
- Click en una fila → modal con JSON completo (datos anteriores/nuevos)
- Eventos con coordenadas GPS muestran botón "Ver en Google Maps"

> Los registros son **inmutables**: no se pueden editar.

### 3.7. Ajustes

(Su perfil + cambio de contraseña + dark mode + logout)

---

## 4. Atajos y tips

| Acción | Atajo |
|---|---|
| Búsqueda global | Próximamente (Sprint 4+) |
| Dark/Light mode | Botón luna/sol en sidebar |
| Paginación | Selector inferior de página |

---

## 5. Soporte

¿Encontró un problema?

1. **Error reproducible:** anote los pasos exactos y capture pantalla.
2. **Error 401/403:** verifique su sesión. Si persiste tras re-login, contacte a RRHH para verificar permisos.
3. **Error 500:** revise `/audit/logs` con su rol ADMIN o contacte al equipo técnico.
4. **Reportar:** use la opción "Reportar problema" en cualquier pantalla (próximamente) o contacte a `soporte@sge.empresa`.

---

**Cambios respecto a versiones anteriores:** ver `CHANGELOG.md`.
**Documentación técnica:** `docs/` (arquitectura, ADRs, runbook AWS).
