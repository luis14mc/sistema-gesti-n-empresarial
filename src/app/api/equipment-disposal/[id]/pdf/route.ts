import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { runDisposalRoute } from '@/modules/equipment-disposal/presentation/http';
import { requireOrganizationPermission } from '@/platform/security/authorization/effective-permissions';
import { EquipmentDisposalError } from '@/modules/equipment-disposal/application/errors';
import { readStoredDocument, buildAttachmentContentDisposition } from '@/lib/compras/orden/document-access';

async function handler(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  return runDisposalRoute(request, 'pdf.download', async ({ context, requestId }) => {
    await requireOrganizationPermission(context.userId, context.organizationId, context.role, 'equipment-disposal.download');
    const { id } = await params;
    const disposal = await prisma.equipmentDisposal.findFirst({ where: { id, organizationId: context.organizationId, status: 'APPROVED' }, select: { folio: true, pdfStorageKey: true } });
    if (!disposal?.pdfStorageKey) throw new EquipmentDisposalError('DISPOSAL_PDF_NOT_FOUND', 404);
    const stored = await readStoredDocument(disposal.pdfStorageKey, 'application/pdf');
    return new NextResponse(new Uint8Array(stored.buffer), { headers: { 'content-type': 'application/pdf', 'content-disposition': buildAttachmentContentDisposition(`${disposal.folio}.pdf`), 'x-request-id': requestId, 'cache-control': 'private, no-store' } });
  });
}
export const GET = withAuth(handler);
