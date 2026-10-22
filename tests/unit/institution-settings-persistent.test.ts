import { beforeEach, describe, expect, it, vi } from 'vitest';

const templateFindFirst = vi.fn();
const templateUpdate = vi.fn();
const templateCreate = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    compraOrdenTemplate: {
      findFirst: (...args: unknown[]) => templateFindFirst(...args),
      update: (...args: unknown[]) => templateUpdate(...args),
      create: (...args: unknown[]) => templateCreate(...args),
    },
  },
}));

describe('institution settings persistence', () => {
  beforeEach(() => {
    templateFindFirst.mockReset();
    templateUpdate.mockReset();
    templateCreate.mockReset();
  });

  it('guardar y leer tras simular redeploy devuelve lo persistido en plantilla activa', async () => {
    const orgId = 'org-persist';
    const userId = 'user-1';
    const templateId = 'tpl-1';

    const storedTemplate = {
      id: templateId,
      organizationId: orgId,
      institutionName: 'Consejo Nacional de Inversiones',
      institutionAddress: 'Dirección inicial',
      institutionPhone: '(504) 1111-1111',
      institutionWebsite: 'www.cni.hn',
      logoUrl: '/Logo_CNI.png',
      isActive: true,
      version: 1,
    };

    templateFindFirst.mockResolvedValue(storedTemplate);
    templateUpdate.mockImplementation(async ({ data }) => ({
      ...storedTemplate,
      institutionName: data.institutionName ?? storedTemplate.institutionName,
      institutionAddress: data.institutionAddress ?? storedTemplate.institutionAddress,
      institutionPhone: data.institutionPhone ?? storedTemplate.institutionPhone,
      institutionWebsite: data.institutionWebsite ?? storedTemplate.institutionWebsite,
      logoUrl: data.logoUrl ?? storedTemplate.logoUrl,
    }));

    vi.resetModules();
    const { saveInstitutionSettings } = await import(
      '@/modules/purchases/infrastructure/institution-store'
    );

    await saveInstitutionSettings(orgId, userId, {
      name: 'CNI Persistente',
      address: 'Nueva sede permanente',
    });

    expect(templateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: templateId },
        data: expect.objectContaining({
          institutionName: 'CNI Persistente',
          institutionAddress: 'Nueva sede permanente',
        }),
      }),
    );

    templateFindFirst.mockResolvedValue({
      ...storedTemplate,
      institutionName: 'CNI Persistente',
      institutionAddress: 'Nueva sede permanente',
    });

    vi.resetModules();
    const { getInstitutionSettings: getAfterRedeploy } = await import(
      '@/modules/purchases/infrastructure/institution-store'
    );

    const settings = await getAfterRedeploy(orgId);
    expect(settings.name).toBe('CNI Persistente');
    expect(settings.address).toBe('Nueva sede permanente');
  });
});
