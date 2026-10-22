# Manual de Usuario — SGE

> **Sistema de Gestión Empresarial** · entrega operativa v1.0

---

## 1. Acceso al sistema

### Iniciar sesión

1. Abra su navegador en la URL que le proporcionó la institución (por ejemplo la app en Railway).
2. Ingrese **correo** y **contraseña**.
3. Si es su primer acceso con contraseña temporal, el sistema le pedirá **cambiar la contraseña** antes de continuar.

### Cambiar contraseña

En **Administración → Configuración** (o **Ajustes** en el menú inferior):

1. Sección "Cambiar contraseña".
2. Contraseña actual, nueva (mínimo 8 caracteres) y confirmación.
3. Guarde.

### Cerrar sesión

Avatar o menú de usuario → **Cerrar sesión**.

---

## 2. Roles y permisos

El menú lateral muestra solo los módulos permitidos para su usuario. Los roles de organización (ADMIN, PROCUREMENT, SECRETARIA, IT, RRHH, etc.) se combinan con **permisos personalizados** configurados en **Administración → Roles y permisos**.

| Área típica | Quién suele usarla |
| --- | --- |
| Correspondencia / Oficios | SECRETARIA, ADMIN |
| Equipos y asignaciones | IT, ADMIN |
| Compras | PROCUREMENT, ADMINISTRACION, ADMIN |
| Planilla | RRHH, ADMIN |
| Usuarios y roles | ADMIN |

Si falta una opción de menú, pida a un administrador que revise su rol y permisos (no es necesario reinstalar la aplicación).

---

## 3. Módulos

### 3.1. Dashboard

Resumen e accesos rápidos según permisos.

### 3.2. Correspondencia (Oficios)

Menú **Correspondencia**:

| Pantalla | Uso |
| --- | --- |
| **Todos / Entradas / Salidas** | Listados y filtros |
| **Importar** | Carga masiva desde Excel |

**Crear oficio de salida:**

1. Elija el flujo (CNI, Despacho o interno según pantalla).
2. Complete asunto, destinatario e institución.
3. Adjunte documento si la pantalla lo exige.
4. Guarde; el sistema asigna **número correlativo** en salidas.

**Entradas:** registre datos del remitente y adjuntos; el número puede ser el del documento recibido.

### 3.3. Activos (Equipos)

| Pantalla | Uso |
| --- | --- |
| **Equipos** | Inventario, alta, import/export Excel |
| **Asignaciones** | Asignar, devolver, cambio de equipo |
| **Baja de equipos** | Dictamen y flujo de baja |
| **Licencias** | Inventario de licencias de software |

**Asignar:** seleccione equipo → empleado → suba **acta de entrega** → confirme.

**Devolver:** desde asignaciones activas → acta de devolución → confirme.

### 3.4. Personas (Empleados)

Listado y ficha de empleados (código, departamento, datos de contacto). RRHH mantiene datos maestros usados en planilla y asignaciones.

### 3.5. Compras

Menú **Compras**:

| Pantalla | Uso |
| --- | --- |
| **Nueva orden** / **Borradores** | Crear y editar borradores |
| **Órdenes generadas** | PDF, emitir, cerrar, anular |
| **Proveedores** | Catálogo de proveedores |
| **Formato CNI** | Plantilla institucional (permiso de aprobación) |
| **Reportes** | Consultas y exportación |

Flujo habitual: **Borrador** → **Generar** (PDF) → **Emitir** → **Cerrar** o **Anular** según permisos. Puede **adjuntar documentos** en el detalle de la orden.

### 3.6. Planilla

Menú **Planilla**:

| Pantalla | Uso |
| --- | --- |
| **Boletas** | Generar y consultar el mes |
| **Histórico** | Meses anteriores |
| **Empleados en planilla** | Quién entra en nómina |
| **Configuración** | ISR, IHSS y parámetros (solo con permiso) |

Pasos típicos RRHH: configurar deducciones → **generar mes** → revisar boleta → **enviar por correo** (pruebe primero a su propio correo).

### 3.7. Control

| Pantalla | Uso |
| --- | --- |
| **Reportes** | Catálogo institucional |
| **Auditoría institucional** | Auditorías con hallazgos |
| **Auditoría del sistema** | Registro técnico de eventos (según rol) |

Los registros de auditoría del sistema son de **solo lectura**.

### 3.8. Administración

| Pantalla | Uso |
| --- | --- |
| **Configuración** | Preferencias de la cuenta |
| **Roles y permisos** | Matriz por rol y overrides |
| **Usuarios** | Alta, baja, contraseña temporal |
| **Correspondencia** | Ajustes de numeración / scopes |

Tras cambiar permisos de un usuario, el menú se actualiza al **refrescar** o en la siguiente carga de sesión según configuración.

---

## 4. Atajos y tips

| Acción | Dónde |
| --- | --- |
| Modo oscuro / claro | Botón luna/sol en la barra lateral |
| Paginación | Controles al pie de las tablas |

---

## 5. Soporte

1. Anote pasos exactos y capture pantalla.
2. Indique su **rol** y la **hora**.
3. Errores 401/403: cierre sesión e intente de nuevo; si persiste, contacte al administrador.
4. Use la guía [pruebas de aceptación](05-pruebas/pruebas-aceptacion-usuarios.md) para reportes formales.

---

**Cambios por versión:** [CHANGELOG.md](CHANGELOG.md) (raíz del repositorio; copia en `docs/CHANGELOG.md` cuando aplique).

**Documentación técnica:** [docs/deployment/railway.md](deployment/railway.md) (Railway + Cloudflare R2).
