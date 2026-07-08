# Oficios — Submódulos y nomenclatura oficial

## Alcance funcional

El módulo de Oficios se mantiene como uno de los módulos principales del Sistema de Gestión Empresarial. A partir de esta definición, se divide operativamente en tres submódulos:

1. **Internos / Memos**
   - Correspondencia interna institucional.
   - Tipo técnico: `INTERNAL_MEMO`.
   - Nomenclatura generada por el sistema: `MEMO-0001-2026`.

2. **Externos CNI**
   - Oficios externos del Consejo Nacional de Inversiones.
   - Incluye documentos que ingresan y documentos que se envían.
   - Oficios enviados: `Oficio No. 0001-CNI-2026`.
   - Oficios ingresados: código interno de control `ING-CNI-0001-2026`.

3. **Externos Despacho**
   - Oficios externos del Despacho.
   - Incluye documentos que ingresan y documentos que se envían.
   - Oficios enviados: `Oficio No. DPICP-0001-2026`.
   - Oficios ingresados: código interno de control `ING-DPICP-0001-2026`.

## Campos funcionales

| Campo | Descripción |
| --- | --- |
| `scope` | Submódulo operativo: `INTERNO`, `CNI`, `DESPACHO`. |
| `direction` | Dirección del documento: `INCOMING`, `OUTGOING`, `INTERNAL_MEMO`. |
| `number` | Número oficial o código interno generado por el sistema. |
| `subject` | Asunto del oficio o memo. |
| `status` | Estado del flujo: borrador, enviado, recibido, en proceso, completado, archivado. |
| `oficioDate` | Fecha del oficio. |
| `receivedDate` | Fecha de recepción, cuando aplique. |
| `sentDate` | Fecha de envío, cuando aplique. |
| `attachments` | Documento digitalizado obligatorio. |
| `comments` | Observaciones internas. |

## Reglas de numeración

La numeración debe generarse en backend para evitar duplicidades y mantener una sola fuente de verdad.

| Submódulo | Dirección | Formato |
| --- | --- | --- |
| Despacho | Saliente | `DPICP-0001-2026` |
| CNI | Saliente | `0001-CNI-2026` |
| Interno / Memo | Interno | `MEMO-0001-2026` |
| CNI | Ingresado | `ING-CNI-0001-2026` |
| Despacho | Ingresado | `ING-DPICP-0001-2026` |

## Módulos fuera de alcance

Los siguientes módulos quedan deshabilitados del alcance funcional actual:

- Tickets
- Asistencia
- Inventario promocional

Actualmente las rutas legacy `/tickets`, `/inventory` y `/time-entries` deben redirigir al dashboard y no deben aparecer en el menú operativo.

## Implementación actual

La lógica de normalización y numeración vive en:

```txt
src/lib/oficios-numbering.ts
```

El endpoint principal de creación y listado usa esa lógica en:

```txt
src/app/api/oficios/route.ts
```

## Próximo paso técnico

Crear una interfaz shadcn/ui para Oficios con pestañas o cards de navegación:

- Internos / Memos
- Externos CNI
- Externos Despacho

Cada vista debe reutilizar el mismo listado, pero enviando filtros `scope` y `direction` al endpoint `/api/oficios`.
