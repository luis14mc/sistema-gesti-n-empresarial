import type { PrismaClient, Prisma } from '@prisma/client';
import {
  applyNomenclaturePattern,
  DEFAULT_NUMBERING_PATTERNS,
  DEFAULT_NUMBERING_PREFIXES,
  normalizeOficioDependency,
  shouldGenerateOficioNumber,
  type OficioDependency,
  type OficioDirection,
} from '@/lib/oficios-numbering';

export class OficioNumberingError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'MISSING_CONFIG'
      | 'INACTIVE_CONFIG'
      | 'INVALID_PATTERN'
      | 'SEQUENCE_TOO_LOW'
      | 'NOT_GENERATABLE'
      | 'LOCK_FAILED',
  ) {
    super(message);
    this.name = 'OficioNumberingError';
  }
}

type NumberingConfigRow = {
  id: string;
  organizationId: string;
  dependency: string;
  year: number;
  nomenclaturePattern: string;
  lastGeneratedSequence: number;
  prefix: string | null;
  sequencePadding: number;
  isActive: boolean;
};

export type AllocateOficioNumberResult = {
  documentNumber: string;
  sequence: number;
  year: number;
  dependency: OficioDependency;
  configId: string;
};

/**
 * Atomically allocate the next outgoing document number from OficioNumberingConfig.
 *
 * Uses SELECT … FOR UPDATE inside the caller's transaction so concurrent creates
 * cannot receive the same number. Sequence is only persisted if the surrounding
 * transaction commits (create + increment together).
 */
export async function allocateOficioNumber(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    scope: OficioDependency;
    direction: OficioDirection;
    year: number;
  },
): Promise<AllocateOficioNumberResult> {
  if (!shouldGenerateOficioNumber(input.direction)) {
    throw new OficioNumberingError(
      'Los oficios de entrada no generan número institucional.',
      'NOT_GENERATABLE',
    );
  }

  const dependency = normalizeOficioDependency(input.scope);

  const locked = await tx.$queryRaw<NumberingConfigRow[]>`
    SELECT
      id,
      "organizationId",
      dependency,
      year,
      "nomenclaturePattern",
      "lastGeneratedSequence",
      prefix,
      "sequencePadding",
      "isActive"
    FROM oficio_numbering_configs
    WHERE "organizationId" = ${input.organizationId}
      AND dependency = ${dependency}
      AND year = ${input.year}
    FOR UPDATE
  `;

  const config = locked[0];
  if (!config) {
    throw new OficioNumberingError(
      `No hay configuración de numeración activa para ${dependency} / ${input.year}. Configure en Configuración → Correspondencia.`,
      'MISSING_CONFIG',
    );
  }
  if (!config.isActive) {
    throw new OficioNumberingError(
      `La configuración de numeración para ${dependency} / ${input.year} está inactiva.`,
      'INACTIVE_CONFIG',
    );
  }

  const nextSequence = config.lastGeneratedSequence + 1;
  let documentNumber: string;
  try {
    documentNumber = applyNomenclaturePattern({
      pattern: config.nomenclaturePattern,
      sequence: nextSequence,
      year: config.year,
      prefix: config.prefix,
      sequencePadding: config.sequencePadding,
    });
  } catch (cause) {
    throw new OficioNumberingError(
      cause instanceof Error ? cause.message : 'Patrón de nomenclatura inválido.',
      'INVALID_PATTERN',
    );
  }

  await tx.oficioNumberingConfig.update({
    where: { id: config.id },
    data: { lastGeneratedSequence: nextSequence },
  });

  return {
    documentNumber,
    sequence: nextSequence,
    year: config.year,
    dependency,
    configId: config.id,
  };
}

/**
 * Preview the next number without consuming the sequence.
 */
export async function previewOficioNumber(
  tx: Prisma.TransactionClient | PrismaClient,
  input: { organizationId: string; dependency: OficioDependency; year: number },
): Promise<{ nextNumber: string; lastGeneratedSequence: number; pattern: string } | null> {
  const dependency = normalizeOficioDependency(input.dependency);
  const config = await tx.oficioNumberingConfig.findUnique({
    where: {
      organizationId_dependency_year: {
        organizationId: input.organizationId,
        dependency,
        year: input.year,
      },
    },
  });

  if (!config || !config.isActive) return null;

  return {
    nextNumber: applyNomenclaturePattern({
      pattern: config.nomenclaturePattern,
      sequence: config.lastGeneratedSequence + 1,
      year: config.year,
      prefix: config.prefix,
      sequencePadding: config.sequencePadding,
    }),
    lastGeneratedSequence: config.lastGeneratedSequence,
    pattern: config.nomenclaturePattern,
  };
}

export function defaultConfigSeed(dependency: OficioDependency, year: number) {
  return {
    dependency,
    year,
    nomenclaturePattern: DEFAULT_NUMBERING_PATTERNS[dependency],
    prefix: DEFAULT_NUMBERING_PREFIXES[dependency],
    lastGeneratedSequence: 0,
    sequencePadding: 0,
    isActive: true,
  };
}
