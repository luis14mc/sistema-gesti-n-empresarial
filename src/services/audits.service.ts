import { apiHelpers } from '@/utils/api';
import type {
    Audit,
    CreateAuditData,
    UpdateAuditData,
    AuditFinding,
    CreateFindingData,
    AuditChecklistItem,
    CreateChecklistItemData,
    UpdateChecklistResultData
} from '@/types';

const BASE_URL = '/api/audits';

export interface AuditListResponse {
    audits: Audit[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export const auditsService = {
    // Listar auditorías
    list: (filters?: any) =>
        apiHelpers.get<AuditListResponse>(BASE_URL, filters),

    // Obtener detalle de auditoría
    getById: (id: string) =>
        apiHelpers.get<{ audit: Audit }>(`${BASE_URL}/${id}`),

    // Crear auditoría
    create: (data: CreateAuditData) =>
        apiHelpers.post<{ audit: Audit }>(BASE_URL, data),

    // Actualizar auditoría
    update: (id: string, data: UpdateAuditData) =>
        apiHelpers.patch<{ audit: Audit }>(`${BASE_URL}/${id}`, data),

    // Eliminar auditoría
    delete: (id: string) =>
        apiHelpers.delete(`${BASE_URL}/${id}`),

    // Hallazgos
    addFinding: (auditId: string, data: CreateFindingData) =>
        apiHelpers.post<{ finding: AuditFinding }>(`${BASE_URL}/${auditId}/findings`, data),

    // Checklist
    addChecklistItem: (auditId: string, data: CreateChecklistItemData) =>
        apiHelpers.post<{ item: AuditChecklistItem }>(`${BASE_URL}/${auditId}/checklist`, data),

    updateChecklistResult: (auditId: string, itemId: string, data: UpdateChecklistResultData) =>
        apiHelpers.patch<{ item: AuditChecklistItem }>(`${BASE_URL}/${auditId}/checklist`, { itemId, ...data }),
};
