import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/platform/api/with-auth';
import { authorizeOrganization } from '@/platform/security/authorization/http';
import {
  generateDischargeActa,
  getDischargeActaPrefill,
  listDischargeActasForEmployee,
} from '@/modules/equipment/application/discharge-acta-service';

const postBodySchema = z.object({
  terminationDate: z.string().min(1),
  dni: z.string().max(50),
  position: z.string().max(200),
  closeAssignmentsAndLicenses: z.boolean().optional().default(true),
  equipmentRows: z.array(
    z.object({
      item: z.string(),
      brandModel: z.string(),
      serial: z.string(),
      notes: z.string(),
    }),
  ),
  accessoryRows: z.array(
    z.object({ item: z.string(), quantity: z.string(), state: z.string(), notes: z.string() }),
  ),
  licenseRows: z.array(
    z.object({ software: z.string(), licenseNumber: z.string(), notes: z.string() }),
  ),
  accessRows: z.array(
    z.object({ system: z.string(), status: z.string(), notes: z.string() }),
  ),
  miscRows: z.array(z.object({ item: z.string(), state: z.string(), notes: z.string() })),
});

async function getHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.read');
    const { id } = await params;
    const mode = new URL(req.url).searchParams.get('mode');

    if (mode === 'history') {
      const history = await listDischargeActasForEmployee(organizationId, id);
      return NextResponse.json({ actas: history });
    }

    const prefill = await getDischargeActaPrefill(organizationId, id);
    if (!prefill) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }
    return NextResponse.json(prefill);
  } catch (error) {
    console.error('discharge-acta GET failed', requestId, error);
    return NextResponse.json({ error: 'Error al cargar acta de descargo' }, { status: 500 });
  }
}

async function postHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    const { organizationId } = await authorizeOrganization(req, requestId, 'equipment.update');
    const { id } = await params;
    const parsed = postBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
    }

    const result = await generateDischargeActa({
      organizationId,
      employeeId: id,
      actorUserId: req.user!.userId,
      input: parsed.data,
    });

    if (result.kind === 'not_found') {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }
    if (result.kind === 'validation') {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ url: result.url, storageKey: result.storageKey });
  } catch (error) {
    console.error('discharge-acta POST failed', requestId, error);
    return NextResponse.json({ error: 'No se pudo generar el acta de descargo' }, { status: 500 });
  }
}

export const GET = withAuth(getHandler);
export const POST = withAuth(postHandler);
