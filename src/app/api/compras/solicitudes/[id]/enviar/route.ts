import { withAuth, type AuthenticatedRequest } from '@/lib/middleware';
import type { Role } from '@/types';
import { executeCompraWorkflow } from '@/lib/compras/workflow-handler';

type RouteContext = { params: Promise<{ id: string }> };

function makeWorkflowRoute(action: Parameters<typeof executeCompraWorkflow>[0]['action']) {
  return withAuth(async (req: AuthenticatedRequest, context: RouteContext) => {
    const { id } = await context.params;
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    return executeCompraWorkflow({
      userId: req.user!.userId,
      role: req.user!.role as Role,
      solicitudId: id,
      action,
      body,
    });
  });
}

export const POST = makeWorkflowRoute('enviar');
