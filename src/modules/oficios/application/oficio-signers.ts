import { createAuditRecord } from '@/platform/security/audit/audit-record';
import {
  createOficioSigner,
  findOficioSignerById,
  listOficioSigners,
  parseSignerDependency,
  updateOficioSigner,
} from '@/modules/oficios/infrastructure/signer-repository';

export async function listOficioSignersUseCase(params: {
  organizationId: string;
  dependency?: string | null;
  activeOnly: boolean;
}) {
  const signers = await listOficioSigners(params);
  return { signers };
}

export async function createOficioSignerUseCase(params: {
  organizationId: string;
  actorUserId: string;
  body: Record<string, unknown>;
}) {
  const name = String(params.body.name ?? '').trim();
  const positionTitle = String(params.body.positionTitle ?? '').trim();

  if (!name || !positionTitle) {
    return { kind: 'validation_error' as const, error: 'Nombre y cargo del firmante son obligatorios' };
  }

  const signer = await createOficioSigner({
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
    name,
    positionTitle,
    dependency: parseSignerDependency(params.body.dependency),
    isActive: params.body.isActive !== false,
  });

  await createAuditRecord({
    title: 'Firmante de oficios creado',
    description: `${signer.name} — ${signer.positionTitle}`,
    module: 'OFICIOS',
    category: 'CREATE',
    userId: params.actorUserId,
    entityId: signer.id,
    organizationId: params.organizationId,
    newData: signer,
  });

  return { kind: 'created' as const, signer };
}

export async function updateOficioSignerUseCase(params: {
  organizationId: string;
  actorUserId: string;
  signerId: string;
  body: Record<string, unknown>;
}) {
  const current = await findOficioSignerById(params.organizationId, params.signerId);
  if (!current) {
    return { kind: 'not_found' as const };
  }

  const name =
    params.body.name !== undefined ? String(params.body.name).trim() : current.name;
  const positionTitle =
    params.body.positionTitle !== undefined
      ? String(params.body.positionTitle).trim()
      : current.positionTitle;

  if (!name || !positionTitle) {
    return { kind: 'validation_error' as const, error: 'Nombre y cargo del firmante son obligatorios' };
  }

  const dependency =
    params.body.dependency !== undefined
      ? parseSignerDependency(params.body.dependency)
      : current.dependency;
  const isActive =
    params.body.isActive !== undefined ? Boolean(params.body.isActive) : current.isActive;

  const signer = await updateOficioSigner(current.id, {
    name,
    positionTitle,
    dependency,
    isActive,
  });

  const activationChanged = current.isActive !== signer.isActive;
  await createAuditRecord({
    title: activationChanged
      ? signer.isActive
        ? 'Firmante de oficios activado'
        : 'Firmante de oficios desactivado'
      : 'Firmante de oficios actualizado',
    description: `${signer.name} — ${signer.positionTitle}`,
    module: 'OFICIOS',
    category: 'UPDATE',
    userId: params.actorUserId,
    entityId: signer.id,
    organizationId: params.organizationId,
    previousData: {
      name: current.name,
      positionTitle: current.positionTitle,
      dependency: current.dependency,
      isActive: current.isActive,
    },
    newData: {
      name: signer.name,
      positionTitle: signer.positionTitle,
      dependency: signer.dependency,
      isActive: signer.isActive,
    },
  });

  return { kind: 'updated' as const, signer };
}
