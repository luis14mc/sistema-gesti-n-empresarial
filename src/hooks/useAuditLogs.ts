import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { AuditLog } from '@/types';

interface AuditLogResponse {
    logs: AuditLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

interface AuditLogFilters {
    userId?: string;
    module?: string;
    action?: string;
    search?: string;
    page?: number;
    pageSize?: number;
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
    const query = useQuery<AuditLogResponse>({
        queryKey: ['audit-logs', filters],
        queryFn: async () => {
            const { data } = await axios.get('/api/audit-logs', { params: filters });
            return data;
        },
    });

    return {
        logs: query.data?.logs || [],
        total: query.data?.total || 0,
        page: query.data?.page || 1,
        pageSize: query.data?.pageSize || 20,
        totalPages: query.data?.totalPages || 0,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}
