import { searchOficios } from '@/modules/oficios/infrastructure/oficio-repository';

export async function searchOficiosUseCase(params: {
  organizationId: string;
  userRole: string;
  userId: string;
  userEmail: string;
  searchParams: URLSearchParams;
}) {
  const { searchParams } = params;
  const q = searchParams.get('q')?.trim();
  const page = Math.max(1, Math.min(parseInt(searchParams.get('page') || '1', 10) || 1, 10_000));
  const pageSize = Math.min(
    Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10) || 25),
    100,
  );

  return searchOficios({
    organizationId: params.organizationId,
    userRole: params.userRole,
    userId: params.userId,
    userEmail: params.userEmail,
    filters: {
      q,
      scope: searchParams.get('scope')?.trim(),
      status: searchParams.get('status')?.trim(),
      recordSource: searchParams.get('recordSource')?.trim(),
      type: searchParams.get('type')?.trim(),
      hasDocument: searchParams.get('hasDocument'),
      yearParam: searchParams.get('year'),
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      page,
      pageSize,
    },
  });
}
