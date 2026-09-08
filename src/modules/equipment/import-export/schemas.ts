import { z } from 'zod';
import { EQUIPMENT_EXCEL_TYPES } from './types';

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional();

export const equipmentInputSchema = z.object({
  type: z.string().trim().max(100).optional(),
  category: z.string().trim().max(60).optional(),
  brand: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(120),
  serialNumber: optionalText(120).nullable(),
  inventoryCode: optionalText(60),
  assetCode: optionalText(60),
  purchaseDate: z.coerce.date().optional().nullable(),
  purchaseOrder: optionalText(120).nullable(),
  supplier: optionalText(200).nullable(),
  warrantyDate: z.coerce.date().optional().nullable(),
  cost: z.coerce.number().nonnegative().optional().nullable(),
  ram: optionalText(60).nullable(),
  processor: optionalText(200).nullable(),
  storage: optionalText(60).nullable(),
  os: optionalText(100).nullable(),
  includedAccessories: optionalText(2000).nullable(),
  installedSoftware: optionalText(2000).nullable(),
  ipAddress: z.string().refine((value) => value === '' || /^(\d{1,3}\.){3}\d{1,3}$/.test(value), { message: 'ipAddress inválida' }).optional().nullable(),
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$|^$/, { message: 'MAC inválida' }).optional().nullable(),
  location: optionalText(200).nullable(),
  notes: optionalText(2000).nullable(),
}).refine(
  (data) => !data.warrantyDate || !data.purchaseDate || data.warrantyDate >= data.purchaseDate,
  { message: 'warrantyDate debe ser >= purchaseDate', path: ['warrantyDate'] },
);

export const equipmentImportRowSchema = z.object({
  inventoryCode: optionalText(60),
  type: z.enum(EQUIPMENT_EXCEL_TYPES),
  brand: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(120),
  serialNumber: optionalText(120),
  purchaseDate: z.date().optional(),
  processor: optionalText(200),
  ram: optionalText(60),
  storage: optionalText(60),
  os: optionalText(100),
  includedAccessories: optionalText(2000),
  installedSoftware: optionalText(2000),
  notes: optionalText(2000),
});

export type EquipmentInput = z.infer<typeof equipmentInputSchema>;
