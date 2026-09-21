import type { PrismaClient, Prisma } from '@prisma/client';
import {
  normalizeOficioDependency,
  parseOficioSequence,
  previewNextNumber,
  validateNomenclaturePattern,
  type OficioDependency,
} from '@/lib/oficios-numbering';
import { OficioNumberingError, defaultConfigSeed } from '@/modules/oficios/infrastructure/numbering';

export type NumberingConfigInput = {
  dependency: string;
  year: number;
  nomenclaturePattern: string;
  lastGeneratedSequence: number;
  prefix?: string | null;
  sequencePadding?: number | null;
  notes?: string | null;
  isActive?: boolean;
  /**
   * Explicit elevated correction: allows lowering below the configured/used floor.
   * Caller must authorize ADMIN/OWNER and require a non-empty reason.
   */
  allowSequenceCorrection?: boolean;
  reason?: string | null;
};

export const SEQUENCE_FLOOR_ERROR =
  'El correlativo no puede ser menor al último correlativo registrado/configurado.';

/**
 * Highest sequence already used by outgoing correspondence for org/dependency/year.
 * Prefers sequenceYear; falls back to oficioDate year.
 */
export async function findHighestUsedSequence(
  db: PrismaClient | Prisma.TransactionClient,
  input: { organizationId: string; dependency: OficioDependency; year: number },
): Promise<number> {
  const dependency = normalizeOficioDependency(input.dependency);
  const rows = await db.oficio.findMany({
    where: {
      organizationId: input.organizationId,
      scope: dependency,
      type: dependency === 'INTERNO' ? 'INTERNAL_MEMO' : 'OUTGOING',
      OR: [
        { sequenceYear: input.year },
        {
          sequenceYear: null,
          oficioDate: {
            gte: new Date(Date.UTC(input.year, 0, 1)),
            lt: new Date(Date.UTC(input.year + 1, 0, 1)),
          },
        },
      ],
    },
    select: { number: true },
  });

  let highest = 0;
  for (const row of rows) {
    const seq = parseOficioSequence(row.number, input.year);
    if (seq > highest) highest = seq;
  }
  return highest;
}

export async function listNumberingConfigs(
  db: PrismaClient,
  organizationId: string,
) {
  return db.oficioNumberingConfig.findMany({
    where: { organizationId },
    orderBy: [{ dependency: 'asc' }, { year: 'desc' }],
  });
}

export async function upsertNumberingConfig(
  db: PrismaClient,
  organizationId: string,
  userId: string,
  input: NumberingConfigInput,
) {
  const dependency = normalizeOficioDependency(input.dependency);
  const year = input.year;
  if (!Number.isInteger(year) || year < 1990 || year > 2100) {
    throw new OficioNumberingError('Año de configuración inválido.', 'INVALID_PATTERN');
  }

  const patternCheck = validateNomenclaturePattern(input.nomenclaturePattern);
  if (!patternCheck.valid) {
    throw new OficioNumberingError(patternCheck.error, 'INVALID_PATTERN');
  }

  const lastGeneratedSequence = Math.max(0, Math.floor(input.lastGeneratedSequence));
  const highestUsed = await findHighestUsedSequence(db, {
    organizationId,
    dependency,
    year,
  });

  const existing = await db.oficioNumberingConfig.findUnique({
    where: {
      organizationId_dependency_year: { organizationId, dependency, year },
    },
  });

  const configuredFloor = existing?.lastGeneratedSequence ?? 0;
  const sequenceFloor = Math.max(highestUsed, configuredFloor);
  const isLowering = lastGeneratedSequence < sequenceFloor;

  if (isLowering && !input.allowSequenceCorrection) {
    throw new OficioNumberingError(SEQUENCE_FLOOR_ERROR, 'SEQUENCE_TOO_LOW');
  }

  if (isLowering && input.allowSequenceCorrection) {
    const reason = input.reason?.trim();
    if (!reason) {
      throw new OficioNumberingError(
        'Debe indicar el motivo de la corrección elevada del correlativo.',
        'SEQUENCE_TOO_LOW',
      );
    }
  }

  const sequencePadding = Math.max(0, Math.min(input.sequencePadding ?? 0, 8));

  if (existing) {
    return db.oficioNumberingConfig.update({
      where: { id: existing.id },
      data: {
        nomenclaturePattern: input.nomenclaturePattern.trim(),
        lastGeneratedSequence,
        prefix: input.prefix?.trim() || null,
        sequencePadding,
        notes: input.notes?.trim() || null,
        isActive: input.isActive ?? true,
        updatedById: userId,
      },
    });
  }

  return db.oficioNumberingConfig.create({
    data: {
      organizationId,
      dependency,
      year,
      nomenclaturePattern: input.nomenclaturePattern.trim(),
      lastGeneratedSequence,
      prefix: input.prefix?.trim() || null,
      sequencePadding,
      notes: input.notes?.trim() || null,
      isActive: input.isActive ?? true,
      createdById: userId,
      updatedById: userId,
    },
  });
}

export async function ensureDefaultNumberingConfigs(
  db: PrismaClient,
  organizationId: string,
  userId?: string,
  year = new Date().getFullYear(),
) {
  const dependencies: OficioDependency[] = ['CNI', 'DESPACHO', 'INTERNO'];
  const results = [];

  for (const dependency of dependencies) {
    const existing = await db.oficioNumberingConfig.findUnique({
      where: {
        organizationId_dependency_year: { organizationId, dependency, year },
      },
    });
    if (existing) {
      results.push(existing);
      continue;
    }
    const seed = defaultConfigSeed(dependency, year);
    const created = await db.oficioNumberingConfig.create({
      data: {
        organizationId,
        ...seed,
        createdById: userId,
        updatedById: userId,
      },
    });
    results.push(created);
  }

  return results;
}

export function serializeNumberingConfig(
  config: {
    id: string;
    organizationId: string;
    dependency: string;
    year: number;
    nomenclaturePattern: string;
    lastGeneratedSequence: number;
    prefix: string | null;
    sequencePadding: number;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
) {
  const nextNumber = previewNextNumber({
    pattern: config.nomenclaturePattern,
    lastGeneratedSequence: config.lastGeneratedSequence,
    year: config.year,
    prefix: config.prefix,
    sequencePadding: config.sequencePadding,
  });

  return {
    ...config,
    nextNumber,
  };
}
