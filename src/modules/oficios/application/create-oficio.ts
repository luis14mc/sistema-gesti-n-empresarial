import type { OficioType as PrismaOficioType, Prisma } from '@prisma/client';
import { createAuditRecord } from '@/lib/audit';
import { OficioBadRequestError } from '@/modules/oficios/domain/errors';
import {
  normalizeOficioDirection,
  normalizeOficioDocumentKind,
  normalizeOficioScope,
} from '@/modules/oficios/domain/oficios-numbering';
import {
  isSignerCompatibleWithDependency,
  signerDependencyMismatchMessage,
} from '@/modules/oficios/domain/signer-compatibility';
import {
  parseOficioAttachments,
  isOficioAttachmentUrlAllowed,
} from '@/modules/oficios/infrastructure/oficios-attachments';
import {
  createOficioWithTracking,
  findActiveEmployee,
  findOficioSignerForCreate,
  findRelatedOficioId,
} from '@/modules/oficios/infrastructure/oficio-repository';

function toPrismaOficioType(direction: ReturnType<typeof normalizeOficioDirection>): PrismaOficioType {
  return direction as PrismaOficioType;
}

export async function createOficioUseCase(params: {
  organizationId: string;
  actorUserId: string;
  body: Record<string, unknown>;
}) {
  const { organizationId, actorUserId, body } = params;
  const {
    subject,
    number,
    externalNumber,
    type,
    direction,
    scope,
    origin,
    dependency,
    documentKind,
    recipient,
    institution,
    preparedBy,
    oficioDate,
    receivedDate,
    sentDate,
    attachments,
    comments,
    senderName,
    senderPosition,
    recipientName,
    recipientPosition,
    cc,
    responseToId,
    signerId,
    responsibleEmployeeId,
  } = body;

  const oficioScope = normalizeOficioScope(
    String(dependency ?? scope ?? origin ?? ''),
  );
  const oficioDirection = normalizeOficioDirection(
    String(direction ?? type ?? ''),
    oficioScope,
  );
  const kind = normalizeOficioDocumentKind(
    documentKind as string | null | undefined,
  );
  const incomingNumber = (externalNumber ?? number)?.toString().trim();
  const motivo = subject?.toString().trim();
  const destinatario = (recipientName ?? recipient)?.toString().trim();
  const institucion = institution?.toString().trim();
  const elaboradoPor = preparedBy?.toString().trim();

  if (!motivo || !oficioDate) {
    throw new OficioBadRequestError('Asunto y fecha del documento son requeridos');
  }

  if (!institucion) {
    throw new OficioBadRequestError('La institución es obligatoria');
  }

  if (oficioDirection === 'INCOMING' && !incomingNumber) {
    throw new OficioBadRequestError(
      'Los oficios de entrada deben registrar el número original externo',
    );
  }

  if (oficioDirection !== 'INCOMING' && !destinatario) {
    throw new OficioBadRequestError('El destinatario es obligatorio para salidas');
  }

  if (!attachments || (Array.isArray(attachments) && attachments.length === 0)) {
    throw new OficioBadRequestError(
      'Es obligatorio adjuntar el documento oficial para crear el oficio',
    );
  }

  const parsedAttachments = parseOficioAttachments(attachments);
  if (parsedAttachments.length === 0) {
    throw new OficioBadRequestError('El documento adjunto no tiene un formato válido');
  }

  for (const att of parsedAttachments) {
    if (!isOficioAttachmentUrlAllowed(att.url, organizationId)) {
      throw new OficioBadRequestError('URL de documento adjunto no válida');
    }
  }

  const responseToIdStr = responseToId ? String(responseToId) : null;
  if (responseToIdStr) {
    const related = await findRelatedOficioId(organizationId, responseToIdStr);
    if (!related) {
      throw new OficioBadRequestError(
        'El documento relacionado no existe en esta organización',
      );
    }
  }

  if (signerId) {
    const signer = await findOficioSignerForCreate(organizationId, String(signerId));
    if (!signer) {
      throw new OficioBadRequestError(
        'Firmante no válido o no pertenece a esta organización',
      );
    }
    if (!signer.isActive) {
      throw new OficioBadRequestError('El firmante seleccionado está inactivo');
    }
    if (!isSignerCompatibleWithDependency(signer.dependency, oficioScope)) {
      throw new OficioBadRequestError(
        signerDependencyMismatchMessage(signer.dependency ?? 'desconocida', oficioScope),
      );
    }
  }

  if (responsibleEmployeeId) {
    const employee = await findActiveEmployee(organizationId, String(responsibleEmployeeId));
    if (!employee) {
      throw new OficioBadRequestError('Empleado responsable no válido');
    }
  }

  const year = new Date(String(oficioDate)).getFullYear();

  const oficio = await createOficioWithTracking({
    organizationId,
    actorUserId,
    oficioScope,
    oficioDirection,
    kind,
    incomingNumber: incomingNumber!,
    year,
    responseToId: responseToIdStr,
    subject: String(subject),
    createInput: {
      subject: motivo,
      scope: oficioScope,
      documentKind: kind,
      recipient: destinatario || (senderName?.toString().trim() ?? null),
      institution: institucion,
      preparedBy: elaboradoPor || null,
      type: toPrismaOficioType(oficioDirection),
      status: oficioDirection === 'INCOMING' ? 'RECEIVED' : 'DRAFT',
      oficioDate: new Date(String(oficioDate)),
      receivedDate: receivedDate
        ? new Date(String(receivedDate))
        : oficioDirection === 'INCOMING'
          ? new Date()
          : undefined,
      sentDate: sentDate ? new Date(String(sentDate)) : undefined,
      senderName: senderName?.toString().trim() || null,
      senderPosition: senderPosition?.toString().trim() || null,
      recipientName: (recipientName ?? destinatario)?.toString().trim() || null,
      recipientPosition: recipientPosition?.toString().trim() || null,
      cc: cc?.toString().trim() || null,
      comments: comments?.toString().trim() || null,
      responseToId: responseToIdStr,
      signerId: signerId ? String(signerId) : null,
      responsibleEmployeeId: responsibleEmployeeId ? String(responsibleEmployeeId) : null,
      attachments: parsedAttachments as unknown as Prisma.InputJsonValue,
      createdById: actorUserId,
      updatedById: actorUserId,
    },
  });

  await createAuditRecord({
    title: 'Creación de correspondencia',
    description: `Se creó oficio: ${oficio.number} - ${subject}`,
    module: 'OFICIOS',
    category: 'CREATE',
    userId: actorUserId,
    entityId: oficio.id,
    organizationId,
    newData: {
      number: oficio.number,
      subject,
      scope: oficioScope,
      direction: oficioDirection,
      documentKind: kind,
      responseToId: responseToIdStr,
    },
  });

  return { oficio, status: 201 as const };
}
