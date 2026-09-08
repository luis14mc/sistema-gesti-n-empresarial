import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createAuditRecord } from '@/lib/audit';
import { generateAssetCode, resolveEquipmentCategory, CATEGORY_LABELS } from '@/lib/equipment-asset-code';
import { equipmentInputSchema, type EquipmentInput } from './schemas';

type DatabaseClient = typeof prisma;

export async function createEquipmentRecord(input: EquipmentInput, context: {
  organizationId: string;
  userId: string;
  requestId?: string;
  auditAction?: string;
}, client: DatabaseClient = prisma) {
  const data = equipmentInputSchema.parse(input);

  return client.$transaction(async (tx) => {
    const category = resolveEquipmentCategory(data.category, data.type);
    const inventoryCode = data.inventoryCode || data.assetCode || await generateAssetCode(context.organizationId, category, tx);
    const type = data.type || CATEGORY_LABELS[category];
    const equipment = await tx.equipment.create({
      data: {
        organizationId: context.organizationId,
        inventoryCode,
        category,
        type,
        brand: data.brand,
        model: data.model,
        serialNumber: data.serialNumber || null,
        purchaseDate: data.purchaseDate ?? null,
        purchaseOrder: data.purchaseOrder ?? null,
        supplier: data.supplier ?? null,
        warrantyDate: data.warrantyDate ?? null,
        cost: data.cost ?? null,
        ram: data.ram ?? null,
        processor: data.processor ?? null,
        storage: data.storage ?? null,
        os: data.os ?? null,
        includedAccessories: data.includedAccessories ?? null,
        installedSoftware: data.installedSoftware ?? null,
        ipAddress: data.ipAddress ?? null,
        macAddress: data.macAddress ?? null,
        location: data.location ?? null,
        notes: data.notes ?? null,
      },
    });

    await tx.equipmentHistory.create({
      data: {
        equipmentId: equipment.id,
        action: 'CREATED',
        title: 'Equipo registrado',
        description: `Activo ${inventoryCode} (${data.brand} ${data.model}) registrado en inventario.`,
        newData: { inventoryCode, category, brand: data.brand, model: data.model } as Prisma.InputJsonValue,
        performedById: context.userId,
      },
    });

    await createAuditRecord({
      title: 'Creación de equipo',
      description: `Se creó equipo: ${inventoryCode} (${data.brand} ${data.model})`,
      module: 'EQUIPOS',
      category: 'CREATE',
      userId: context.userId,
      entityId: equipment.id,
      entityType: 'Equipment',
      organizationId: context.organizationId,
      action: context.auditAction ?? 'EQUIPMENT_CREATED',
      requestId: context.requestId,
      newData: { inventoryCode, category, brand: data.brand, model: data.model },
      tx,
    });

    return equipment;
  });
}
