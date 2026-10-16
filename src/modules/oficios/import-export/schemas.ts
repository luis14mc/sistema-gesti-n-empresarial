import { z } from 'zod';
import { OficioStatus, OficioType } from '@prisma/client';

const tipoSchema = z.nativeEnum(OficioType);
const statusSchema = z.nativeEnum(OficioStatus);

export const oficioImportRowSchema = z.object({
  number: z.string().trim().min(1, 'El número de oficio es obligatorio.').max(120),
  type: tipoSchema,
  oficioDate: z.date(),
  receivedDate: z.date().optional(),
  sentDate: z.date().optional(),
  dependency: z.string().trim().min(1, 'La dependencia es obligatoria.'),
  institution: z.string().trim().max(200).optional(),
  senderName: z.string().trim().max(200).optional(),
  senderPosition: z.string().trim().max(200).optional(),
  recipientName: z.string().trim().max(200).optional(),
  recipientPosition: z.string().trim().max(200).optional(),
  subject: z.string().trim().min(1, 'El asunto es obligatorio.').max(500),
  status: statusSchema,
  preparedBy: z.string().trim().max(200).optional(),
  responsibleRef: z.string().trim().max(200).optional(),
  cc: z.string().trim().max(500).optional(),
  comments: z.string().trim().max(2000).optional(),
});

export type OficioImportRowSchema = z.infer<typeof oficioImportRowSchema> & {
  type: OficioType;
  status: OficioStatus;
};

export const oficioImportCommitSchema = z.object({
  duplicates: z.enum(['skip', 'import']),
  nextSequenceOverrides: z.record(z.string(), z.coerce.number().int().min(0)).default({}),
});
