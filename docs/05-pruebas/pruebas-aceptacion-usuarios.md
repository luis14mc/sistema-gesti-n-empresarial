# Pruebas de aceptación (usuarios)

> **⚠️ IMPORTANTE — numeración oficial**
>
> - Las pruebas se hacen en el **sistema REAL**. Crear un oficio de **SALIDA** o **GENERAR** una orden de compra consume un **número correlativo oficial** que **no se puede reutilizar**.
> - Para esos pasos use un trámite **REAL del día** (un oficio u orden que de todos modos había que hacer), **NO** uno inventado.
> - Si se generó uno de prueba por error, **anúlelo de inmediato** y anote el número en **Comentario** para dejar constancia.
> - **Proveedores**, **usuarios** y **borradores** de prueba sí se pueden crear con datos ficticios y desactivar después.

Use esta lista para validar el sistema **antes de la entrega**. Marque **¿OK?** (Sí / No) y anote comentarios si algo falla.

> **Roles sugeridos:** use una cuenta de prueba por rol indicado. Si no tiene acceso a un módulo, anótelo en Comentario.

---

## Compras (PROCUREMENT / ADMINISTRACION)

| Paso | Resultado esperado | ¿OK? | Comentario |
| --- | --- | --- | --- |
| Inicie sesión con usuario de **Compras** y abra **Compras → Nueva orden** (o borradores). | Ve el formulario de orden de compra. | | |
| Cree un **borrador** con al menos un ítem y guarde. | La orden queda en estado borrador y aparece en la lista de borradores. | | |
| Abra el borrador y **edite** cantidad, descripción o proveedor; guarde. | Los cambios se guardan sin error. | | |
| Pulse **Generar** (PDF / orden generada). | Pasa a estado generada y puede ver la vista previa o PDF. | | |
| Abra el **PDF** o vista previa de la orden. | Se muestra el documento con datos coherentes (ítems, totales). | | |
| Con permiso de aprobación, **emita** la orden. | Estado pasa a emitida; número o sello coherente con el flujo. | | |
| **Anule** una orden que lo permita el estado (según su rol). | La orden queda anulada; ya no aparece como activa. | | |
| **Cierre** una orden emitida (si aplica a su rol). | Estado cerrado; no permite editar como borrador. | | |
| **Adjunte un documento** (PDF/imagen) a una orden. | El archivo aparece en la lista de documentos y se puede abrir. | | |
| Abra **Proveedores** y cree o edite un proveedor de prueba. | El proveedor se guarda y aparece en búsquedas. | | |
| Abra **Reportes** de compras y **exporte** (Excel/PDF según pantalla). | Descarga un archivo sin error 403/500. | | |

---

## Oficios / Correspondencia (SECRETARIA)

| Paso | Resultado esperado | ¿OK? | Comentario |
| --- | --- | --- | --- |
| Abra **Oficios** (CNI, Despacho o Internos según use la institución). | Ve listado y botón para crear. | | |
| Cree un **oficio de salida**. | Se asigna **número correlativo** automático (formato del scope). | | |
| Registre un **oficio de entrada** con datos del remitente. | Queda guardado; número externo o flujo de entrada coherente. | | |
| **Cambie el estado** del oficio (workflow visible en pantalla). | El estado se actualiza y se refleja en el detalle. | | |
| **Adjunte** un archivo permitido (PDF/imagen). | El adjunto se ve en el detalle. | | |
| Use **buscar/filtrar** por número, asunto o fecha. | Encuentra el oficio creado. | | |
| Use **Importar Excel** (si está habilitado) con plantilla de prueba. | Importación termina con resumen (éxitos/errores) comprensible. | | |

---

## Equipos (IT)

| Paso | Resultado esperado | ¿OK? | Comentario |
| --- | --- | --- | --- |
| Abra **Equipos** y **registre** un equipo nuevo (categoría, código o serial). | Aparece en el inventario. | | |
| **Asigne** el equipo a un empleado y suba **acta de entrega**. | Asignación activa; acta visible o descargable. | | |
| **Devuelva** el equipo con acta de devolución. | Asignación cerrada; equipo disponible o en estado coherente. | | |
| Realice un **cambio de equipo** (swap/reemplazo según menú Asignaciones). | Queda historial de ambas asignaciones. | | |
| Registre **mantenimiento** del equipo. | Evento visible en historial del equipo. | | |
| **Exporte** inventario a Excel. | Archivo descargado con filas del inventario. | | |
| **Importe** Excel de equipos (plantilla válida). | Resumen de importación; equipos nuevos o actualizados. | | |

---

## Planilla (RRHH / ADMIN)

| Paso | Resultado esperado | ¿OK? | Comentario |
| --- | --- | --- | --- |
| Abra **Planilla → Configuración** (ISR / IHSS). | Ve tasas y tramos; puede guardar si tiene permiso. | | |
| **Genere** boletas del **mes** en curso o mes de prueba. | Proceso termina; boletas listadas. | | |
| Abra una **boleta** y revise salario, deducciones y neto. | Montos coherentes con configuración. | | |
| **Envíe por correo** una boleta (primero **a su propio correo**). | Indica enviado o encolado; llega el correo o queda registro de intento. | | |
| Abra **Histórico** de planilla. | Ve meses anteriores y puede abrir detalle/PDF. | | |

---

## Usuarios y roles (ADMIN)

| Paso | Resultado esperado | ¿OK? | Comentario |
| --- | --- | --- | --- |
| Cree un **usuario** de prueba con rol básico. | Usuario aparece en listado. | | |
| Asigne **contraseña temporal** o flujo de primer acceso. | Al ingresar, el sistema **obliga a cambiar contraseña**. | | |
| **Cambie el rol** del usuario de prueba. | Rol actualizado en ficha. | | |
| Ajuste **permisos personalizados** (override) en Roles y permisos. | Cambios guardados. | | |
| Con el usuario de prueba **sin cerrar sesión del admin**, verifique el **menú** del usuario (otra ventana o re-login del usuario). | El menú refleja el rol/permisos **sin requerir cerrar sesión global** (o tras refrescar según diseño). | | |

---

## General (cualquier usuario)

| Paso | Resultado esperado | ¿OK? | Comentario |
| --- | --- | --- | --- |
| **Login** con credenciales válidas. | Entra al dashboard o pantalla inicial. | | |
| **Logout** desde el menú de usuario. | Vuelve a pantalla de login. | | |
| Intente login con **contraseña incorrecta 5 veces** (cuenta de prueba). | Cuenta o IP con **bloqueo temporal**; mensaje claro. | | |
| Active **modo oscuro** (botón luna/sol). | La interfaz cambia de tema y se mantiene al navegar. | | |

---

## Cómo reportar un error

1. **Captura de pantalla** del error (incluya URL si es posible).
2. Indique **rol de usuario** y **hora aproximada**.
3. Describa **qué hizo paso a paso** justo antes del fallo.
4. Envíe al equipo técnico o registre en el canal acordado (correo / ticket interno).
