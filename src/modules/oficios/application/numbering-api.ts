import { createAuditRecord } from '@/lib/audit';
import { serializeNumberingConfig } from '@/modules/oficios/application/numbering-config';
import {
  previewNextNumber,
  validateNomenclaturePattern,
} from '@/modules/oficios/domain/oficios-numbering';
import {
  ensureDefaultNumberingConfigsForOrg,
  findNumberingConfigByKey,
  listNumberingConfigsForOrg,
  upsertNumberingConfigForOrg,
} from '@/modules/oficios/infrastructure/numbering-queries';

export async function listNumberingConfigsUseCase(params: {
  organizationId: string;
  actorUserId: string;
}) {
  await ensureDefaultNumberingConfigsForOrg(params.organizationId, params.actorUserId);
  const configs = await listNumberingConfigsForOrg(params.organizationId);
  return { configs: configs.map(serializeNumberingConfig) };
}

export async function upsertNumberingConfigUseCase(params: {
  organizationId: string;
  actorUserId: string;
  organizationRole: string;
  body: Record<string, unknown>;
}) {
  const body = params.body;
  const existing = await findNumberingConfigByKey({
    organizationId: params.organizationId,
    dependency: String(body.dependency ?? ''),
    year: Number(body.year),
  });

  const requestedSequence = Number(body.lastGeneratedSequence ?? 0);
  const elevatedRoles = new Set(['ADMIN', 'OWNER']);
  const isElevatedAdmin = elevatedRoles.has(params.organizationRole);
  const forceRequested = Boolean(body.forceSequenceCorrection);

  if (forceRequested && !isElevatedAdmin) {
    return {
      kind: 'forbidden' as const,
      error:
        'Solo un administrador puede realizar una corrección elevada del correlativo.',
      code: 'SEQUENCE_CORRECTION_FORBIDDEN',
    };
  }

  if (forceRequested && !String(body.reason ?? '').trim()) {
    return {
      kind: 'bad_request' as const,
      error: 'Debe indicar el motivo de la corrección elevada del correlativo.',
      code: 'SEQUENCE_CORRECTION_REASON_REQUIRED',
    };
  }

  const config = await upsertNumberingConfigForOrg(params.organizationId, params.actorUserId, {
    dependency: String(body.dependency ?? ''),
    year: Number(body.year),
    nomenclaturePattern: String(body.nomenclaturePattern ?? ''),
    lastGeneratedSequence: requestedSequence,
    prefix: body.prefix as string | null | undefined,
    sequencePadding: body.sequencePadding as number | null | undefined,
    notes: body.notes as string | null | undefined,
    isActive: body.isActive !== false,
    allowSequenceCorrection: forceRequested && isElevatedAdmin,
    reason: body.reason as string | null | undefined,
  });

  const sequenceChanged =
    existing != null && existing.lastGeneratedSequence !== config.lastGeneratedSequence;
  const wasCorrection =
    forceRequested &&
    existing != null &&
    config.lastGeneratedSequence < existing.lastGeneratedSequence;

  await createAuditRecord({
    title: wasCorrection
      ? 'Corrección elevada de correlativo de oficios'
      : existing
        ? 'Numeración de oficios actualizada'
        : 'Numeración de oficios creada',
    description: `${config.dependency} / ${config.year}: ${config.nomenclaturePattern}`,
    module: 'OFICIOS',
    category: existing ? 'UPDATE' : 'CREATE',
    userId: params.actorUserId,
    entityId: config.id,
    organizationId: params.organizationId,
    previousData: existing
      ? {
          nomenclaturePattern: existing.nomenclaturePattern,
          lastGeneratedSequence: existing.lastGeneratedSequence,
          year: existing.year,
          isActive: existing.isActive,
        }
      : undefined,
    newData: {
      nomenclaturePattern: config.nomenclaturePattern,
      lastGeneratedSequence: config.lastGeneratedSequence,
      year: config.year,
      isActive: config.isActive,
      reason: body.reason ?? null,
      forceSequenceCorrection: wasCorrection,
      sequenceAdjusted: sequenceChanged,
    },
  });

  return {
    kind: 'saved' as const,
    config: serializeNumberingConfig(config),
    status: existing ? 200 : 201,
  };
}

export function previewNumberingPatternUseCase(body: Record<string, unknown>) {
  const pattern = String(body.nomenclaturePattern ?? '');
  const validation = validateNomenclaturePattern(pattern);
  if (!validation.valid) {
    return { kind: 'invalid' as const, error: validation.error };
  }

  const nextNumber = previewNextNumber({
    pattern,
    lastGeneratedSequence: Number(body.lastGeneratedSequence ?? 0),
    year: Number(body.year ?? new Date().getFullYear()),
    prefix: body.prefix as string | null | undefined,
    sequencePadding: body.sequencePadding as number | null | undefined,
  });

  return { kind: 'valid' as const, nextNumber };
}
