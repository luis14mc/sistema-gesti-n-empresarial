import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { generarCompraOrden, getCompraOrden } from '@/lib/compras/orden/service';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import type { Role } from '@/types';
import { isMissingBrowserError } from '@/lib/compras/pdf-renderer';
import { InvalidPurchaseOrderError } from '@/lib/compras/orden/generation-validation';
import { requireOrganizationContext } from '@/modules/organizations/application/context';

async function postHandler(
  req: AuthenticatedRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();
  let orderId = 'unknown';
  let stage = 'LOAD_ORDER';
  try {
    const role = req.user!.role as Role;
    const { organizationId } = await requireOrganizationContext(req, requestId);
    const { id } = await params;
    orderId = id;
    console.info('[PURCHASE ORDER VALIDATION START]', { requestId, orderId });
    const existing = await getCompraOrden(id, organizationId);
    if (!existing) {
      return NextResponse.json(
        {
          error: 'PURCHASE_ORDER_NOT_FOUND',
          message: 'La orden solicitada no existe.',
          requestId,
        },
        { status: 404 }
      );
    }
    if (existing.status !== 'DRAFT') {
      return NextResponse.json(
        {
          error: 'PURCHASE_ORDER_ALREADY_GENERATED',
          message: 'La orden ya fue generada.',
          requestId,
          orderNumber: existing.orderNumber,
        },
        { status: 409 }
      );
    }

    if (
      !canOrdenAction(role, 'generar', {
        isCreator: existing.createdById === req.user!.userId,
        status: existing.status,
      })
    ) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Sin permisos', requestId },
        { status: 403 }
      );
    }

    const orden = await generarCompraOrden(id, req.user!.userId, organizationId, (nextStage) => {
      stage = nextStage;
    });
    return NextResponse.json({ orden });
  } catch (error) {
    const responseStage = isMissingBrowserError(error) ? 'GENERATE_PDF' : stage;
    console.error('[PURCHASE ORDER VALIDATION ERROR]', {
      requestId,
      orderId,
      stage: responseStage,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      cause: error instanceof Error && 'cause' in error ? error.cause : undefined,
    });

    if (isMissingBrowserError(error)) {
      return NextResponse.json(
        {
          error: 'PDF_BROWSER_NOT_AVAILABLE',
          message: 'El motor de generación de PDF no está disponible.',
          stage: 'GENERATE_PDF',
          requestId,
        },
        { status: 503 }
      );
    }
    if (error instanceof Error && error.message === 'ORDER_NOT_FOUND') {
      return NextResponse.json(
        {
          error: 'PURCHASE_ORDER_NOT_FOUND',
          message: 'La orden solicitada no existe.',
          requestId,
        },
        { status: 404 }
      );
    }
    if (error instanceof Error && error.message === 'ORDER_ALREADY_GENERATED') {
      return NextResponse.json(
        {
          error: 'PURCHASE_ORDER_ALREADY_GENERATED',
          message: 'La orden ya fue generada.',
          requestId,
        },
        { status: 409 }
      );
    }
    if (error instanceof InvalidPurchaseOrderError) {
      return NextResponse.json(
        {
          error: 'INVALID_ORDER_DATA',
          message: 'La orden contiene datos incompletos o inválidos.',
          details: error.validationErrors,
          requestId,
        },
        { status: 400 }
      );
    }

    const code = error instanceof Error && [
      'ACTIVE_PURCHASE_FORMAT_NOT_FOUND',
      'PURCHASE_ORDER_RENDER_FAILED',
      'PURCHASE_ORDER_PDF_STORAGE_FAILED',
    ].includes(error.message)
      ? error.message
      : 'PURCHASE_ORDER_GENERATION_FAILED';
    return NextResponse.json(
      {
        error: code,
        message: process.env.NODE_ENV === 'development' && error instanceof Error
          ? error.message
          : 'No se pudo generar la orden de compra.',
        stage: process.env.NODE_ENV === 'development' ? responseStage : undefined,
        requestId,
      },
      { status: 500 }
    );
  }
}

export const POST = withAuth(postHandler);
