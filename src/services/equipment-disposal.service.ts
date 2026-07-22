import { api } from '@/utils/api';
import type { OrganizationRole } from '@prisma/client';

export type DisposalListItem = {
  id: string;
  folio: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  disposalResult: string;
  evaluationScore: number;
  serialNumber: string;
  brand: string;
  model: string;
  createdAt: string;
  equipment: { inventoryCode: string };
  _count: { documents: number };
};

export type DisposalDetail = DisposalListItem & {
  department: string;
  custodianName?: string | null;
  purchaseDate: string;
  purchasePrice: string;
  estimatedRepairCost: string;
  estimatedReplacementPrice: string;
  physicalCondition: string;
  functionalCondition: string;
  securitySupportStatus: string;
  technicalNotes?: string | null;
  evaluationRationales?: { rationales?: string[] } | null;
  documents: Array<{ id: string; originalName: string; mimeType: string; fileSize: number; createdAt: string }>;
  history: Array<{ id: string; action: string; createdAt: string }>;
};

type Envelope<T> = { success: true; data: T; requestId: string };

export const equipmentDisposalApi = {
  currentOrganization: () => api.get<Envelope<{
    organization: { id: string; slug: string; name: string; logoUrl?: string | null };
    membership: { id: string; role: OrganizationRole };
  }>>('/api/organizations/current'),
  list: (params: { page: number; pageSize: number; status?: string; search?: string }) =>
    api.get<Envelope<{ items: DisposalListItem[]; total: number; totalPages: number; page: number; pageSize: number }>>('/api/equipment-disposal', { params }),
  create: (data: Record<string, unknown>) => api.post<Envelope<{ id: string; folio: string }>>('/api/equipment-disposal', data),
  get: (id: string) => api.get<Envelope<DisposalDetail>>(`/api/equipment-disposal/${id}`),
  uploadDocument: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<Envelope<unknown>>(`/api/equipment-disposal/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  deleteDocument: (id: string, documentId: string) => api.delete<Envelope<unknown>>(`/api/equipment-disposal/${id}/documents/${documentId}`),
  command: (id: string, command: 'submit' | 'approve', data?: object) => api.post<Envelope<unknown>>(`/api/equipment-disposal/${id}/${command}`, data ?? {}),
  reasonCommand: (id: string, command: 'reject' | 'cancel', reason: string) => api.post<Envelope<unknown>>(`/api/equipment-disposal/${id}/${command}`, { reason }),
};
