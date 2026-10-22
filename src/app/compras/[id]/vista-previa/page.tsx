import { notFound } from 'next/navigation';
import { requireSession } from '@/platform/security/authentication/session';
import { getCompraOrden } from '@/modules/purchases/application/purchase-order-use-cases';
import { canOrdenAction } from '@/modules/purchases/domain/purchase-order-permissions';
import { buildPreviewDataFromSerializedOrder } from '@/modules/purchases/presentation/purchase-order-preview-data';
import { PurchaseOrderDocument } from '@/components/compras/document/PurchaseOrderDocument';
import { requirePageOrganizationId } from '@/lib/organization-page-context';
import { findMembershipByOrgUser } from '@/modules/users/infrastructure/user-repository';
import { listEffectiveOrganizationPermissions } from '@/platform/security/authorization/effective-permissions';
import { organizationRoleForSessionRole } from '@/platform/security/module-effective';

export const dynamic = 'force-dynamic';

export default async function CompraVistaPreviaPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireSession();
  const organizationId = await requirePageOrganizationId(user.id);
  const membership = await findMembershipByOrgUser(organizationId, user.id);
  const orgRole = membership?.role ?? organizationRoleForSessionRole(user.role);
  const permissions = await listEffectiveOrganizationPermissions(user.id, organizationId, orgRole);
  const { id } = await params;
  const orden = await getCompraOrden(id, organizationId);
  if (!orden?.format) notFound();
  if (
    !canOrdenAction(permissions, 'read', {
      membershipRole: orgRole,
      sessionRole: user.role,
      isCreator: orden.createdById === user.id,
    })
  ) {
    notFound();
  }
  const document = buildPreviewDataFromSerializedOrder(orden, orden.format);
  return (
    <main className="h-full overflow-y-auto bg-muted p-6">
      <div className="mx-auto min-h-[1056px] w-[816px] bg-white px-[45px] py-[45px] shadow-lg">
        <PurchaseOrderDocument order={document} format={orden.format} draft={document.isDraft} />
      </div>
    </main>
  );
}
