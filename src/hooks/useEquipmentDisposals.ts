'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { equipmentDisposalApi } from '@/services/equipment-disposal.service';
import { equipmentKeys } from '@/hooks/useEquipment';
import { getHttpStatus } from '@/lib/api-error';

const retryTenantQuery = (failureCount: number, error: unknown) => {
  const status = getHttpStatus(error);
  return status && [401, 403, 409].includes(status) ? false : failureCount < 2;
};

export function useCurrentOrganization() {
  return useQuery({
    queryKey: ['current-organization'],
    queryFn: async () => (await equipmentDisposalApi.currentOrganization()).data.data,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: retryTenantQuery,
  });
}

export function useEquipmentDisposals(filters: { page: number; pageSize: number; status?: string; search?: string }) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.data?.organization.id;
  const query = useQuery({
    queryKey: ['equipment-disposals', organizationId, filters],
    queryFn: async () => (await equipmentDisposalApi.list(filters)).data.data,
    enabled: organization.isSuccess && Boolean(organizationId),
    retry: retryTenantQuery,
  });
  const create = useMutation({
    mutationFn: equipmentDisposalApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-disposals', organizationId] });
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all });
    },
  });
  const command = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'submit' | 'approve' | 'reject' | 'cancel'; reason?: string }) =>
      action === 'reject' || action === 'cancel'
        ? equipmentDisposalApi.reasonCommand(id, action, reason ?? '')
        : equipmentDisposalApi.command(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-disposals', organizationId] });
      queryClient.invalidateQueries({ queryKey: equipmentKeys.all });
    },
  });
  return { organization, query, create, command };
}

export function useEquipmentDisposal(id: string) {
  const organization = useCurrentOrganization();
  const queryClient = useQueryClient();
  const organizationId = organization.data?.organization.id;
  const query = useQuery({
    queryKey: ['equipment-disposals', organizationId, 'detail', id],
    queryFn: async () => (await equipmentDisposalApi.get(id)).data.data,
    enabled: organization.isSuccess && Boolean(organizationId && id),
    retry: retryTenantQuery,
  });
  const upload = useMutation({
    mutationFn: (file: File) => equipmentDisposalApi.uploadDocument(id, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipment-disposals', organizationId, 'detail', id] }),
  });
  const remove = useMutation({
    mutationFn: (documentId: string) => equipmentDisposalApi.deleteDocument(id, documentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['equipment-disposals', organizationId, 'detail', id] }),
  });
  return { organization, query, upload, remove };
}
