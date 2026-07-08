import { apiHelpers } from '@/utils/api';
import type { CorrectiveAction } from '@/types';

const BASE_URL = '/api/corrective-actions';

export const correctiveActionsService = {
    list: (filters?: any) =>
        apiHelpers.get<{ actions: CorrectiveAction[] }>(BASE_URL, filters),

    create: (data: any) =>
        apiHelpers.post<{ action: CorrectiveAction }>(BASE_URL, data),

    update: (id: string, data: any) =>
        apiHelpers.patch<{ action: CorrectiveAction }>(`${BASE_URL}/${id}`, data),

    delete: (id: string) =>
        apiHelpers.delete(`${BASE_URL}/${id}`),
};
