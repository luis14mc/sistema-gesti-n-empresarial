import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { isOrganizationContextError } from '@/modules/organizations/application/context';
import { createEquipment, listEquipment } from '@/modules/equipment/application/equipment-service';
import { mapEquipmentResponse } from '@/modules/equipment/presentation/equipment-mapper';
import { authorizeOrganization, authorizationFailure } from '@/platform/security/authorization/http';
import { equipmentInputSchema } from '@/modules/equipment/import-export/schemas';
import { apiFailure, apiSuccess } from '@/platform/api/response';
import { z } from 'zod';

function organizationFailure(error: unknown, requestId: string) {
  if (!isOrganizationContextError(error)) return null;
  const message = error.code === 'ORGANIZATION_SELECTION_REQUIRED'
    ? 'Seleccione la organización con la que desea trabajar.'
    : error.code === 'AUTHENTICATION_REQUIRED'
      ? 'Debe iniciar sesión para continuar.'
      : 'No existe una organización activa para este usuario.';
  return apiFailure(error.code, message, { requestId, status: error.status, details: [], stage: 'RESOLVE_ORGANIZATION_CONTEXT' });
}

async function getHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'equipment.read');
    const result = await listEquipment({
      organizationId: organization.organizationId,
      role: req.user!.role,
      userId: req.user!.userId,
      query: Object.fromEntries(req.nextUrl.searchParams),
    });
    return apiSuccess(result, { requestId });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    const failure = organizationFailure(error, requestId);
    if (failure) return failure;
    if (error instanceof z.ZodError) {
      return apiFailure('INVALID_EQUIPMENT_QUERY', 'Los filtros de equipos son inválidos.', { requestId, status: 400, details: error.issues, stage: 'VALIDATE_QUERY' });
    }
    console.error('[EQUIPMENT LIST ERROR]', { requestId, error });
    return apiFailure('EQUIPMENT_LIST_FAILED', 'No se pudieron cargar los equipos.', { requestId, status: 500, details: [], stage: 'LIST_EQUIPMENT' });
  }
}

async function postHandler(req: AuthenticatedRequest) {
  const requestId = crypto.randomUUID();
  try {
    const organization = await authorizeOrganization(req, requestId, 'equipment.create');
    const body = await req.json();
    const parsed = equipmentInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const created = await createEquipment({
      organizationId: organization.organizationId,
      userId: req.user!.userId,
      requestId,
      body: parsed.data,
    });

    if (created.kind === 'duplicate') {
      return NextResponse.json({ error: 'Código de activo o número de serie duplicado' }, { status: 409 });
    }

    return NextResponse.json({ equipment: mapEquipmentResponse(created.equipment) }, { status: 201 });
  } catch (error) {
    const denied = authorizationFailure(error, requestId);
    if (denied) return denied;
    const failure = organizationFailure(error, requestId);
    if (failure) return failure;
    console.error('Error al crear equipo:', error);
    return apiFailure('EQUIPMENT_CREATE_FAILED', 'No se pudo crear el equipo.', { requestId, status: 500, details: [], stage: 'CREATE_EQUIPMENT' });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
