import { createCompraWorkflowRoute } from '@/lib/compras/workflow-route';

export const POST = createCompraWorkflowRoute('rechazar', { requireMotivo: true });
