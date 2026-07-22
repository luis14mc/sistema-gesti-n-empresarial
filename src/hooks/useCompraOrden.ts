'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { compraOrdenService } from '@/services/compra-orden.service';
import { getApiErrorData } from '@/lib/api-error';
import type { CompraOrdenFilters, CreateCompraOrdenData, UpdateCompraOrdenData } from '@/types/compra-orden';

async function unwrapOrden<T>(
  promise: Promise<{ data: T }>
): Promise<T> {
  const response = await promise;
  return response.data;
}

export const ordenKeys = {
  all: ['compra-ordenes'] as const,
  lists: () => [...ordenKeys.all, 'list'] as const,
  list: (filters?: CompraOrdenFilters) => [...ordenKeys.lists(), filters] as const,
  detail: (id: string) => [...ordenKeys.all, 'detail', id] as const,
  historial: (id: string) => [...ordenKeys.all, 'historial', id] as const,
  documentos: (id: string) => [...ordenKeys.all, 'documentos', id] as const,
  activeTemplate: () => ['purchase-order-active-format'] as const,
};

export type OrdenWorkflowActionName = 'validar' | 'generar' | 'emitir' | 'anular' | 'cerrar' | 'regenerar_pdf';

export function useCompraOrdenes(filters?: CompraOrdenFilters) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ordenKeys.list(filters),
    queryFn: async () => (await compraOrdenService.list(filters)).data,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateCompraOrdenData) => {
      const result = await unwrapOrden(compraOrdenService.create(data));
      return result.orden;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ordenKeys.lists() }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateCompraOrdenData }) => {
      const result = await unwrapOrden(compraOrdenService.update(id, data));
      return result.orden;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ordenKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ordenKeys.detail(vars.id) });
    },
  });

  const workflowMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      motivoAnulacion,
    }: {
      id: string;
      action: OrdenWorkflowActionName;
      motivoAnulacion?: string;
    }) => {
      switch (action) {
        case 'validar':
          return (await compraOrdenService.validar(id)).data.orden;
        case 'generar':
          return (await compraOrdenService.generar(id)).data.orden;
        case 'emitir':
          return (await compraOrdenService.emitir(id)).data.orden;
        case 'regenerar_pdf':
          return (await compraOrdenService.regenerarPdf(id)).data.orden;
        case 'cerrar':
          return (await compraOrdenService.cerrar(id)).data.orden;
        case 'anular':
          return (await compraOrdenService.anular(id, motivoAnulacion ?? '')).data.orden;
      }
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ordenKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ordenKeys.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: ordenKeys.historial(vars.id) });
    },
    onError: (error) => {
      if (process.env.NODE_ENV !== 'development') return;

      const data = getApiErrorData(error);
      console.error('[PURCHASE ORDER WORKFLOW ERROR]', {
        error: data.error,
        message: data.message,
        stage: data.stage,
        details: data.details,
        requestId: data.requestId,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await compraOrdenService.delete(id);
    },
    onSuccess: (_d, id) => {
      queryClient.invalidateQueries({ queryKey: ordenKeys.lists() });
      queryClient.removeQueries({ queryKey: ordenKeys.detail(id) });
    },
  });

  const documentoMutation = useMutation({
    mutationFn: async ({ id, file, tipo }: { id: string; file: File; tipo: string }) =>
      compraOrdenService.uploadDocumento(id, file, tipo),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ordenKeys.detail(vars.id) });
      queryClient.invalidateQueries({ queryKey: ordenKeys.documentos(vars.id) });
      queryClient.invalidateQueries({ queryKey: ordenKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ordenKeys.historial(vars.id) });
    },
  });

  const deleteDocumentoMutation = useMutation({
    mutationFn: async ({ orderId, documentId }: { orderId: string; documentId: string }) =>
      compraOrdenService.deleteDocumento(orderId, documentId),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ordenKeys.detail(vars.orderId) });
      queryClient.invalidateQueries({ queryKey: ordenKeys.documentos(vars.orderId) });
      queryClient.invalidateQueries({ queryKey: ordenKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ordenKeys.historial(vars.orderId) });
    },
  });

  return {
    ordenes: listQuery.data?.ordenes ?? [],
    totalPages: listQuery.data?.totalPages ?? 1,
    isLoading: listQuery.isLoading,
    createOrden: createMutation.mutateAsync,
    updateOrden: updateMutation.mutateAsync,
    runWorkflow: workflowMutation.mutateAsync,
    deleteOrden: deleteMutation.mutateAsync,
    uploadDocumento: documentoMutation.mutateAsync,
    deleteDocumento: deleteDocumentoMutation.mutateAsync,
    isSaving:
      createMutation.isPending ||
      updateMutation.isPending ||
      workflowMutation.isPending ||
      deleteMutation.isPending ||
      documentoMutation.isPending ||
      deleteDocumentoMutation.isPending,
  };
}

export function useCompraOrden(id: string) {
  return useQuery({
    queryKey: ordenKeys.detail(id),
    queryFn: async () => (await compraOrdenService.get(id)).data.orden,
    enabled: !!id,
  });
}

export function useActivePurchaseOrderTemplate() {
  return useQuery({
    queryKey: ordenKeys.activeTemplate(),
    queryFn: async () => (await compraOrdenService.getActiveTemplate()).data.template,
  });
}

export function useCompraOrdenHistorial(id: string) {
  return useQuery({
    queryKey: ordenKeys.historial(id),
    queryFn: async () => (await compraOrdenService.getHistorial(id)).data.historial,
    enabled: !!id,
  });
}
