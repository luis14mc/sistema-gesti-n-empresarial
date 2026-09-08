import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createEquipmentRecord } from './equipment-create';
import { parseEquipmentWorkbook } from './equipment-excel';
import type { EquipmentImportError, EquipmentImportResult } from './types';

export async function importEquipmentWorkbook(input: {
  buffer: Buffer;
  organizationId: string;
  userId: string;
  requestId: string;
}): Promise<EquipmentImportResult> {
  const parsed = await parseEquipmentWorkbook(input.buffer);
  const errors: EquipmentImportError[] = [...parsed.errors];
  const codes = parsed.rows.flatMap((row) => row.inventoryCode ? [row.inventoryCode] : []);
  const serials = parsed.rows.flatMap((row) => row.serialNumber ? [row.serialNumber] : []);
  const existing = codes.length || serials.length ? await prisma.equipment.findMany({
    where: {
      organizationId: input.organizationId,
      OR: [
        ...(codes.length ? [{ inventoryCode: { in: codes, mode: 'insensitive' as const } }] : []),
        ...(serials.length ? [{ serialNumber: { in: serials, mode: 'insensitive' as const } }] : []),
      ],
    },
    select: { inventoryCode: true, serialNumber: true },
  }) : [];
  const existingCodes = new Set(existing.map((item) => item.inventoryCode.toUpperCase()));
  const existingSerials = new Set(existing.flatMap((item) => item.serialNumber ? [item.serialNumber.toUpperCase()] : []));

  let imported = 0;
  for (const row of parsed.rows) {
    if (row.inventoryCode && existingCodes.has(row.inventoryCode.toUpperCase())) {
      errors.push({ row: row.row, field: 'Número de inventario', code: 'DUPLICATE_INVENTORY', message: 'El número de inventario ya existe.' });
      continue;
    }
    if (row.serialNumber && existingSerials.has(row.serialNumber.toUpperCase())) {
      errors.push({ row: row.row, field: 'Número de serie', code: 'DUPLICATE_SERIAL', message: 'El número de serie ya existe.' });
      continue;
    }
    try {
      await createEquipmentRecord({ ...row, category: row.type }, {
        organizationId: input.organizationId,
        userId: input.userId,
        requestId: input.requestId,
        auditAction: 'EQUIPMENT_BULK_IMPORT_ITEM',
      });
      imported += 1;
    } catch (error) {
      const duplicate = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      errors.push({ row: row.row, field: duplicate ? 'Número de inventario / serie' : 'Fila', code: duplicate ? 'DUPLICATE_DATABASE_VALUE' : 'IMPORT_FAILED', message: duplicate ? 'El equipo entra en conflicto con un registro existente.' : 'No se pudo importar la fila.' });
    }
  }

  return { totalRows: parsed.totalRows, imported, skipped: parsed.totalRows - imported, errors };
}
