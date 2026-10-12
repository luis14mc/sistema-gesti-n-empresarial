import { useQuery } from '@tanstack/react-query';
import { fetchReportsCatalog } from '@/services/reports.service';

export const reportCatalogKeys = {
  all: ['reports-catalog'] as const,
};

export function useReportsCatalog() {
  return useQuery({
    queryKey: reportCatalogKeys.all,
    queryFn: fetchReportsCatalog,
    staleTime: 60_000,
  });
}
