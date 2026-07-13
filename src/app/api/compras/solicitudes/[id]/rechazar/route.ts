import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import type { Role } from '@/types';
import { executeCompraWorkflow } from '@/lib/compras/workflow-handler';

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withAuth(async (req: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  return executeCompraWorkflow({
    userId: req.user!.userId,
    role: req.user!.role as Role,
    solicitudId: id,
    action: 'rechazar_jefe',
    body,
  });
});
