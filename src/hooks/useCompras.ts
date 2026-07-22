'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { comprasService } from '@/services/compras.service';
import { getApiErrorMessage } from '@/lib/api-error';
import type {
  CompraSolicitudFilters,
  CreateCompraSolicitudData,
  UpdateCompraSolicitudData,
  CreateProveedorData,
} from '@/types/compras';

export const compraKeys = {
  all: ['compras'] as const,
  lists: () => [...compraKeys.all, 'list'] as const,
  list: (filters?: CompraSolicitudFilters) => [...compraKeys.lists(), filters] as const,
  detail: (id: string) => [...compraKeys.all, 'detail', id] as const,
  proveedores: (search?: string) => [...compraKeys.all, 'proveedores', search] as const,
};

export type CompraWorkflowActionName =
  | 'generar_orden'
  | 'emitir'
  | 'regenerar_pdf'
  | 'cerrar'
  | 'anular';

export function useComprasSolicitudes(filters?: CompraSolicitudFilters) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: compraKeys.list(filters),
    queryFn: async () => (await comprasService.listSolicitudes(filters)).data,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateCompraSolicitudData) => {
      try {
        const response = await comprasService.createSolicitud(data);
        return response.data.solicitud;
      } catch (error) {
        throw new Error(getApiErrorMessage(error, 'No se pudo guardar la orden'));
      }
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
    mutationFn: async ({ id, action }: { id: string; action: CompraWorkflowActionName }) => {
      switch (action) {
        case 'generar_orden':
          return (await comprasService.generarOrden(id)).data.solicitud;
        case 'emitir':
          return (await comprasService.emitir(id)).data.solicitud;
        case 'regenerar_pdf':
          return (await comprasService.regenerarPdf(id)).data.solicitud;
        case 'cerrar':
          return (await comprasService.cerrar(id)).data.solicitud;
        case 'anular':
          return (await comprasService.anular(id)).data.solicitud;
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: compraKeys.lists() });
      queryClient.invalidateQueries({ queryKey: compraKeys.detail(vars.id) });
    },
  });

  const adjuntoMutation = useMutation({
    mutationFn: async ({ id, file, tipo }: { id: string; file: File; tipo: string }) =>
      (await comprasService.uploadAdjunto(id, file, tipo)).data.adjunto,
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: compraKeys.detail(vars.id) });
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
    uploadAdjunto: adjuntoMutation.mutateAsync,
    isSaving:
      createMutation.isPending ||
      updateMutation.isPending ||
      workflowMutation.isPending ||
      adjuntoMutation.isPending,
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

export function useCreateProveedor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateProveedorData) =>
      (await comprasService.createProveedor(data)).data.proveedor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: compraKeys.proveedores() }),
  });
}

export function useComprasReportes(year: number) {
  return useQuery({
    queryKey: [...compraKeys.all, 'reportes', year] as const,
    queryFn: async () => (await comprasService.getReportes(year)).data,
  });
}

export function useInstitutionConfig() {
  return useQuery({
    queryKey: [...compraKeys.all, 'institucion'] as const,
    queryFn: async () => (await comprasService.getInstitution()).data,
  });
}
