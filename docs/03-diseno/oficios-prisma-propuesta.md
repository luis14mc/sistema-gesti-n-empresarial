# Propuesta Prisma — Campos adicionales para Oficio

## Estado: aplicado en desarrollo

Los siguientes campos fueron agregados al modelo `Oficio`:

```prisma
scope       String?
recipient   String?
institution String?
preparedBy  String?
```

Migración local:

```bash
npx prisma db push
```

## Campos UI ↔ modelo

| UI | Campo Prisma |
|----|--------------|
| No. Oficio | `number` |
| Destinatario | `recipient` |
| Institución | `institution` |
| Motivo | `subject` |
| Elaborado Por | `preparedBy` |
| Fecha | `oficioDate` |
| Documento | `attachments` (JSON) |
| Submódulo | `scope` |

## Registros legacy

Registros anteriores sin `recipient` / `institution` / `preparedBy` se resuelven con `resolveOficioFields()` leyendo metadata en `comments` si existe.

## Producción — almacenamiento de documentos

Ver `docs/06-implementacion/oficios-almacenamiento-documentos.md`.

