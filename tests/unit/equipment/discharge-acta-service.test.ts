import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/modules/equipment/infrastructure/discharge-acta-repository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/equipment/infrastructure/discharge-acta-repository')>();
  return {
    ...actual,
    findEmployeeForDischargeActa: vi.fn(),
    closeEmployeeAssetsForDischargeInTransaction: vi.fn(),
  };
});

vi.mock('@/modules/equipment/application/acta-generation', () => ({
  generateReturnActaPdf: vi.fn(),
}));

vi.mock('@/modules/equipment/infrastructure/acta-deliverer', () => ({
  resolveActaDeliverer: vi.fn().mockResolvedValue({
    name: 'Responsable',
    position: 'Jefe',
    department: 'Informática',
  }),
}));

vi.mock('@/modules/equipment/infrastructure/acta-html', () => ({
  buildDischargeActaHtml: vi.fn().mockReturnValue('<html></html>'),
}));

vi.mock('@/modules/equipment/infrastructure/acta-pdf-store', () => ({
  storeDischargeActaPdf: vi.fn().mockResolvedValue({ storageKey: 'key-1', url: '/doc' }),
}));

vi.mock('@/platform/security/audit/audit-record', () => ({
  createAuditRecord: vi.fn(),
}));

import {
  closeEmployeeAssetsForDischargeInTransaction,
  DischargeAssetClosureError,
  findEmployeeForDischargeActa,
} from '@/modules/equipment/infrastructure/discharge-acta-repository';
import { generateReturnActaPdf } from '@/modules/equipment/application/acta-generation';
import { generateDischargeActa } from '@/modules/equipment/application/discharge-acta-service';

describe('generateDischargeActa', () => {
  const baseInput = {
    terminationDate: '2026-08-10',
    dni: '0801-1990-00000',
    position: 'Analista',
    closeAssignmentsAndLicenses: true,
    equipmentRows: [],
    accessoryRows: [],
    licenseRows: [],
    accessRows: [],
    miscRows: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findEmployeeForDischargeActa).mockResolvedValue({
      id: 'emp-1',
      fullName: 'Ana Ficticia',
      dni: '0801-1990-00000',
      position: { name: 'Analista' },
    } as never);
  });

  it('devuelve closure_failed si la transacción de cierre falla (sin PDFs)', async () => {
    vi.mocked(closeEmployeeAssetsForDischargeInTransaction).mockRejectedValue(
      new DischargeAssetClosureError(
        'No se pudo registrar la devolución del equipo CNI-1. Ningún cambio fue guardado.',
      ),
    );

    const result = await generateDischargeActa({
      organizationId: 'org-1',
      employeeId: 'emp-1',
      actorUserId: 'user-1',
      input: baseInput,
    });

    expect(result.kind).toBe('closure_failed');
    expect(generateReturnActaPdf).not.toHaveBeenCalled();
  });

  it('incluye warnings cuando falla un PDF de devolución tras el commit', async () => {
    vi.mocked(closeEmployeeAssetsForDischargeInTransaction).mockResolvedValue({
      closedEquipmentAssignmentIds: ['asg-1', 'asg-2'],
      closedLicenseAssignmentIds: [],
    });
    vi.mocked(generateReturnActaPdf)
      .mockResolvedValueOnce({ url: '/a', storageKey: 'k1' })
      .mockRejectedValueOnce(new Error('Puppeteer unavailable'));

    const result = await generateDischargeActa({
      organizationId: 'org-1',
      employeeId: 'emp-1',
      actorUserId: 'user-1',
      input: baseInput,
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.assignmentId).toBe('asg-2');
    expect(result.warnings[0]?.mensaje).toContain('Regenerar acta');
  });
});
