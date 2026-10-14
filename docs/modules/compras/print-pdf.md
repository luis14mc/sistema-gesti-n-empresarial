# Impresión de órdenes de compra (PDF oficial)

## Comportamiento

La acción **Imprimir** en detalle y listado de órdenes descarga el mismo binario que **Descargar PDF**: el documento `ORDER_PDF` activo servido por `GET /api/compras/ordenes/[id]/documentos/[documentId]/view`. No se re-renderiza HTML.

El cliente (`src/lib/compras/print-pdf.tsx`) obtiene el PDF con `fetch(..., { credentials: 'include' })`, crea un `blob:` URL y lo carga en un `iframe` oculto para invocar `print()`. Si el navegador bloquea la impresión desde iframe o ventanas emergentes, se abre el PDF en una pestaña nueva o se muestra un aviso Sileo con enlace **Abrir PDF**.

## Auditoría

`?purpose=print` en la URL de **view** registra `PURCHASE_ORDER_PRINTED` vía `createAuditRecord` (módulo COMPRAS), en la misma petición que entrega el PDF.

## CSP / COEP

`Cross-Origin-Embedder-Policy: require-corp` permanece; los PDF en `blob:` son same-origin. Se añadió `frame-src 'self' blob:` en `buildCspHeader` (`src/middleware.ts`) para permitir el iframe de impresión.

## Ruta legacy

`/compras/[id]/imprimir` redirige a `/compras/ordenes/[id]`. La vista HTML `PurchaseOrderPrintDocument` ya no se usa en navegación principal.
