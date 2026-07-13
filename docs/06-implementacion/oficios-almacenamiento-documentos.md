# Almacenamiento de documentos — Oficios

## Desarrollo local

Los archivos se guardan en:

```txt
public/uploads/oficios/YYYY/MM/oficio-{timestamp}-{uuid}.ext
```

Endpoint de carga: `POST /api/uploads/oficios` (multipart/form-data).

La lógica está encapsulada en `src/lib/oficios-storage.ts` para facilitar migración.

## Producción

En Vercel u otros entornos serverless, `public/uploads` **no es persistente**. Los archivos subidos se pierden en cada despliegue o reinicio.

### Opciones recomendadas

| Proveedor | Uso |
|-----------|-----|
| AWS S3 | Almacenamiento estándar con URLs firmadas |
| Cloudflare R2 | Compatible S3, sin egress costoso |
| Azure Blob Storage | Entornos Microsoft |
| Servidor propio | Volumen persistente montado en `/uploads` |

### Migración sugerida

1. Crear adaptador `OficioStorageProvider` con métodos `upload()` y `getPublicUrl()`.
2. Implementar `LocalOficioStorage` (actual) y `S3OficioStorage`.
3. Seleccionar proveedor vía variable de entorno `OFICIOS_STORAGE_DRIVER=local|s3|r2`.
4. Mantener el mismo formato JSON en `attachments` del modelo `Oficio`.
