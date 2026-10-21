import {
  findOrganizationIntegration,
  findOrganizationIntegrationId,
  listOrganizationIntegrations,
  type IntegrationListFilters,
} from '@/platform/integrations/infrastructure/integration-repository';

export const integrationQueries = {
  list(organizationId: string, filters: IntegrationListFilters, skip: number, take: number) {
    return listOrganizationIntegrations(organizationId, filters, skip, take);
  },
  find(organizationId: string, id: string) {
    return findOrganizationIntegration(organizationId, id);
  },
  exists(organizationId: string, id: string) {
    return findOrganizationIntegrationId(organizationId, id);
  },
};
