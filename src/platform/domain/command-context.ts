import type { OrganizationContext } from '@/modules/organizations/application/context';

export type CommandContext = Readonly<OrganizationContext & {
  requestId: string;
}>;

export function createCommandContext(context: OrganizationContext, requestId: string): CommandContext {
  return { ...context, requestId };
}
