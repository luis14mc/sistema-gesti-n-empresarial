# PR: Correspondencia — Excel histórico + optimización PDF

Capturas sugeridas para el PR:

1. `/oficios/importar` — pestaña **Importación histórica (Excel)**: plantilla, vista previa con contadores.
2. Misma pantalla — tarjeta **Numeración por dependencia** con correlativo editable.
3. Resumen post-commit con enlace al lote.
4. Listado `/oficios` — badge **Histórico** y filtro por origen.
5. Subida de PDF en detalle de oficio — mensaje de optimización o firma digital.

## Tabla PDF (ejemplo en PR)

| Escenario | Antes | Después | Notas |
|-----------|------:|--------:|-------|
| Escaneo (fixture) | — | — | Ejecutar en entorno con `gs`/`qpdf` |
| Texto vectorial | — | — | qpdf lossless |
| Firmado | hash A | hash A | `signedPdf=true` |
| > `PDF_OPTIMIZE_MAX_INPUT_MB` | N MB | N MB | sin procesar |
