import type { OficioDependency } from '@/modules/oficios/domain/oficios-numbering';
import { buildOficioImportTemplate } from '@/modules/oficios/import-export/oficios-template';
import { listActiveNumberingDependencies } from '@/modules/oficios/infrastructure/numbering-queries';

export async function buildOficioImportTemplateUseCase(organizationId: string) {
  const configs = await listActiveNumberingDependencies(organizationId);
  const dependencies = configs.map((item) => item.dependency as OficioDependency);
  return buildOficioImportTemplate(dependencies);
}
