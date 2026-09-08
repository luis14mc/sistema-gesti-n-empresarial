import { describe, expect, it } from 'vitest';
import { seedCniMasterData, type EmpleadoSeedRecord, type ProveedorSeedRecord } from '../prisma/lib/master-data-seed';

describe('seedCniMasterData', () => {
  it('upserts organization, proveedores and empleados without deleting existing rows', async () => {
    const proveedores: ProveedorSeedRecord[] = [
      { nombreRazonSocial: 'Proveedor Seed Test', rtn: '0801199900001' },
    ];
    const empleados: EmpleadoSeedRecord[] = [
      {
        email: 'seed.test@cni.hn',
        firstName: 'Seed',
        lastName: 'Test',
        employeeCode: 'CNI-SEED-1',
        departmentName: 'Departamento Seed',
        positionName: 'Puesto Seed',
      },
    ];

    const prisma = {
      organization: {
        upsert: async () => ({
          id: 'org_cni_default',
          name: 'Consejo Nacional de Inversiones',
          slug: 'cni',
        }),
      },
      proveedor: {
        findMany: async () => [],
        update: async () => ({}),
        create: async ({ data }: { data: { nombreRazonSocial: string; rtn: string | null } }) => ({
          id: 'prov-1',
          rtn: data.rtn,
          nombreRazonSocial: data.nombreRazonSocial,
        }),
      },
      employee: {
        findMany: async () => [],
        update: async () => ({}),
        create: async () => ({}),
      },
      department: {
        findFirst: async () => null,
        create: async () => ({ id: 'dept-1' }),
      },
      jobPosition: {
        findFirst: async () => null,
        create: async () => ({ id: 'pos-1' }),
        updateMany: async () => ({ count: 0 }),
      },
    } as unknown as Parameters<typeof seedCniMasterData>[0];

    const result = await seedCniMasterData(prisma, { proveedores, empleados });

    expect(result.organizationId).toBe('org_cni_default');
    expect(result.proveedores.created).toBe(1);
    expect(result.empleados.created).toBe(1);
    expect(result.departmentsCreated).toBe(1);
    expect(result.positionsCreated).toBe(1);
  });
});
