'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comprasService } from '@/services/compras.service';
import type {
  CompraSolicitudFilters,
  CreateCompraSolicitudData,
  UpdateCompraSolicitudData,
  CreateProveedorData,
  CompraDocumento,
} from '@/types/compras';

export const compraKeys = {
  all: ['compras'] as const,
  lists: () => [...compraKeys.all, 'list'] as const,
  list: (filters?: CompraSolicitudFilters) => [...compraKeys.lists(), filters] as const,
  detail: (id: string) => [...compraKeys.all, 'detail', id] as const,
  proveedores: (search?: string) => [...compraKeys.all, 'proveedores', search] as const,
  centros: () => [...compraKeys.all, 'centros'] as const,
  reportes: (year?: number) => [...compraKeys.all, 'reportes', year] as const,
};

export function useComprasSolicitudes(filters?: CompraSolicitudFilters) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: compraKeys.list(filters),
    queryFn: async () => (await comprasService.listSolicitudes(filters)).data,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateCompraSolicitudData) => {
      const { data: body } = await comprasService.createSolicitud(data);
      return {
        solicitud: body.data.solicitud,
        documento: body.data.documento,
        warning: body.warning,
      };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: compraKeys.lists() }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCompraSolicitudData }) =>
      (await comprasService.updateSolicitud(id, data)).data.solicitud,
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: compraKeys.lists() });
      queryClient.invalidateQueries({ queryKey: compraKeys.detail(vars.id) });
    },
  });

  const workflowMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      body,
    }: {
      id: string;
      action: 'enviar' | 'autorizar' | 'rechazar' | 'aprobar' | 'emitirOrden' | 'cerrar';
      body?: Record<string, unknown>;
    }) => {
      switch (action) {
        case 'enviar':
          return (await comprasService.enviar(id)).data.solicitud;
        case 'autorizar':
          return (await comprasService.autorizar(id, body)).data.solicitud;
        case 'rechazar':
          return (await comprasService.rechazar(id, body as { motivoRechazo: string })).data.solicitud;
        case 'aprobar':
          return (await comprasService.aprobar(id)).data.solicitud;
        case 'emitirOrden':
          return (await comprasService.emitirOrden(id, body)).data.solicitud;
        case 'cerrar':
          return (await comprasService.cerrar(id)).data.solicitud;
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: compraKeys.lists() });
      queryClient.invalidateQueries({ queryKey: compraKeys.detail(vars.id) });
    },
  });

  const regenerateDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: body } = await comprasService.regenerarDocumento(id);
      return body.data.documento;
    },
    onSuccess: (_d, id) => {
      queryClient.invalidateQueries({ queryKey: compraKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: compraKeys.lists() });
    },
  });

  return {
    solicitudes: listQuery.data?.solicitudes ?? [],
    total: listQuery.data?.total ?? 0,
    page: listQuery.data?.page ?? 1,
    totalPages: listQuery.data?.totalPages ?? 1,
    isLoading: listQuery.isLoading,
    createSolicitud: createMutation.mutateAsync,
    updateSolicitud: updateMutation.mutateAsync,
    runWorkflow: workflowMutation.mutateAsync,
    regenerateDocument: regenerateDocumentMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending || workflowMutation.isPending,
    isRegeneratingDocument: regenerateDocumentMutation.isPending,
  };
}

export function useCompraSolicitud(id: string) {
  return useQuery({
    queryKey: compraKeys.detail(id),
    queryFn: async () => (await comprasService.getSolicitud(id)).data.solicitud,
    enabled: !!id,
  });
}

export function useProveedores(search?: string) {
  return useQuery({
    queryKey: compraKeys.proveedores(search),
    queryFn: async () => (await comprasService.listProveedores(search)).data.proveedores,
  });
}

export function useCentrosCosto() {
  return useQuery({
    queryKey: compraKeys.centros(),
    queryFn: async () => (await comprasService.listCentrosCosto()).data.centros,
  });
}

export function useComprasReportes(year?: number) {
  return useQuery({
    queryKey: compraKeys.reportes(year),
    queryFn: async () => (await comprasService.reportes(year)).data,
  });
}

export function useCreateProveedor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateProveedorData) =>
      (await comprasService.createProveedor(data)).data.proveedor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: compraKeys.proveedores() }),
  });
}
