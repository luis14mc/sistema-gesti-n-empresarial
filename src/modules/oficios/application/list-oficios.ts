import { listOficios } from '@/modules/oficios/infrastructure/oficio-repository';

export async function listOficiosUseCase(params: {
  organizationId: string;
  userRole: string;
  userId: string;
  userEmail: string;
  searchParams: URLSearchParams;
}) {
  return listOficios(params);
}
