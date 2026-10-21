import { normalizeOficioDependency } from '@/modules/oficios/domain/oficios-numbering';
import { previewOficioNumberForOrganization } from '@/modules/oficios/infrastructure/numbering-queries';

export async function previewOficioNumberUseCase(params: {
  organizationId: string;
  dependencyRaw: string | null;
  scopeRaw: string | null;
  yearRaw: string | null;
}) {
  const dependency = normalizeOficioDependency(
    params.dependencyRaw ?? params.scopeRaw ?? '',
  );
  const year = Number.parseInt(
    params.yearRaw || String(new Date().getFullYear()),
    10,
  );

  const preview = await previewOficioNumberForOrganization({
    organizationId: params.organizationId,
    dependency,
    year,
  });

  if (!preview) {
    return {
      kind: 'missing_config' as const,
      dependency,
      year,
    };
  }

  return {
    kind: 'ok' as const,
    dependency,
    year,
    ...preview,
  };
}
