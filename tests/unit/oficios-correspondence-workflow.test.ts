import { describe, expect, it, vi } from 'vitest';
import {
  ensureDefaultNumberingConfigs,
  findHighestUsedSequence,
  SEQUENCE_FLOOR_ERROR,
  SEQUENCE_ISSUED_FLOOR_ERROR,
  upsertNumberingConfig,
} from '@/modules/oficios/application/numbering-config';
import { previewNextNumber } from '@/lib/oficios-numbering';
import {
  isSignerCompatibleWithDependency,
  signerDependencyMismatchMessage,
} from '@/modules/oficios/domain/signer-compatibility';
import { can, organizationRole } from '@/platform/security/authorization/permissions';

describe('signer dependency compatibility', () => {
  it('allows CNI signer for CNI oficio', () => {
    expect(isSignerCompatibleWithDependency('CNI', 'CNI')).toBe(true);
  });

  it('allows global (null) signer for CNI and DESPACHO', () => {
    expect(isSignerCompatibleWithDependency(null, 'CNI')).toBe(true);
    expect(isSignerCompatibleWithDependency(null, 'DESPACHO')).toBe(true);
    expect(isSignerCompatibleWithDependency('', 'CNI')).toBe(true);
  });

  it('rejects DESPACHO signer for CNI oficio', () => {
    expect(isSignerCompatibleWithDependency('DESPACHO', 'CNI')).toBe(false);
  });

  it('rejects CNI signer for DESPACHO oficio', () => {
    expect(isSignerCompatibleWithDependency('CNI', 'DESPACHO')).toBe(false);
  });

  it('builds a clear mismatch message', () => {
    expect(signerDependencyMismatchMessage('DESPACHO', 'CNI')).toMatch(/DESPACHO/);
    expect(signerDependencyMismatchMessage('DESPACHO', 'CNI')).toMatch(/CNI/);
  });
});

describe('numbering config safety', () => {
  it('A) normal update rejects value below max(highestUsed, configured)', async () => {
    // highestUsed 210, configured 241, normal set 220 -> reject
    const db = {
      oficio: {
        findMany: vi.fn().mockResolvedValue([{ number: 'CNI-210-2026' }]),
      },
      oficioNumberingConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'cfg-1',
          lastGeneratedSequence: 241,
        }),
        update: vi.fn(),
        create: vi.fn(),
      },
    };

    await expect(
      upsertNumberingConfig(db as never, 'org-a', 'user-1', {
        dependency: 'CNI',
        year: 2026,
        nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
        lastGeneratedSequence: 220,
      }),
    ).rejects.toMatchObject({
      code: 'SEQUENCE_TOO_LOW',
      message: SEQUENCE_FLOOR_ERROR,
    });
    expect(db.oficioNumberingConfig.update).not.toHaveBeenCalled();
  });

  it('B) ADMIN elevated correction may lower configured value down to highestUsed', async () => {
    // highestUsed 210, configured 241, ADMIN force 220 + reason -> allow
    const db = {
      oficio: {
        findMany: vi.fn().mockResolvedValue([{ number: 'CNI-210-2026' }]),
      },
      oficioNumberingConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'cfg-1',
          lastGeneratedSequence: 241,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'cfg-1',
          lastGeneratedSequence: 220,
        }),
      },
    };

    await upsertNumberingConfig(db as never, 'org-a', 'admin-1', {
      dependency: 'CNI',
      year: 2026,
      nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
      lastGeneratedSequence: 220,
      allowSequenceCorrection: true,
      reason: 'Corrección de correlativo sobreestimado',
    });
    expect(db.oficioNumberingConfig.update).toHaveBeenCalled();
  });

  it('C) ADMIN elevated correction cannot go below highestUsed', async () => {
    // highestUsed 210, configured 241, ADMIN force 209 + reason -> reject
    const db = {
      oficio: {
        findMany: vi.fn().mockResolvedValue([{ number: 'CNI-210-2026' }]),
      },
      oficioNumberingConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'cfg-1',
          lastGeneratedSequence: 241,
        }),
        update: vi.fn(),
      },
    };

    await expect(
      upsertNumberingConfig(db as never, 'org-a', 'admin-1', {
        dependency: 'CNI',
        year: 2026,
        nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
        lastGeneratedSequence: 209,
        allowSequenceCorrection: true,
        reason: 'Intento inválido',
      }),
    ).rejects.toMatchObject({
      code: 'SEQUENCE_TOO_LOW',
      message: SEQUENCE_ISSUED_FLOOR_ERROR,
    });
    expect(db.oficioNumberingConfig.update).not.toHaveBeenCalled();
  });

  it('D) ADMIN cannot reuse an already issued number even with force', async () => {
    // highestUsed 241, configured 241, ADMIN force 200 -> reject
    const db = {
      oficio: {
        findMany: vi.fn().mockResolvedValue([{ number: 'CNI-241-2026' }]),
      },
      oficioNumberingConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'cfg-1',
          lastGeneratedSequence: 241,
        }),
        update: vi.fn(),
      },
    };

    await expect(
      upsertNumberingConfig(db as never, 'org-a', 'admin-1', {
        dependency: 'CNI',
        year: 2026,
        nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
        lastGeneratedSequence: 200,
        allowSequenceCorrection: true,
        reason: 'No se puede reutilizar número emitido',
      }),
    ).rejects.toMatchObject({
      code: 'SEQUENCE_TOO_LOW',
      message: SEQUENCE_ISSUED_FLOOR_ERROR,
    });
    expect(db.oficioNumberingConfig.update).not.toHaveBeenCalled();
  });

  it('allows ADMIN elevated correction exactly at highestUsed', async () => {
    // highestUsed 210, configured 241, ADMIN force 210 + reason -> allow
    const db = {
      oficio: {
        findMany: vi.fn().mockResolvedValue([{ number: 'CNI-210-2026' }]),
      },
      oficioNumberingConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'cfg-1',
          lastGeneratedSequence: 241,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'cfg-1',
          lastGeneratedSequence: 210,
        }),
      },
    };

    await upsertNumberingConfig(db as never, 'org-a', 'admin-1', {
      dependency: 'CNI',
      year: 2026,
      nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
      lastGeneratedSequence: 210,
      allowSequenceCorrection: true,
      reason: 'Alinear con último emitido',
    });
    expect(db.oficioNumberingConfig.update).toHaveBeenCalled();
  });

  it('requires reason when elevated correction lowers configured value', async () => {
    const db = {
      oficio: {
        findMany: vi.fn().mockResolvedValue([{ number: 'CNI-210-2026' }]),
      },
      oficioNumberingConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'cfg-1',
          lastGeneratedSequence: 241,
        }),
        update: vi.fn(),
      },
    };

    await expect(
      upsertNumberingConfig(db as never, 'org-a', 'admin-1', {
        dependency: 'CNI',
        year: 2026,
        nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
        lastGeneratedSequence: 220,
        allowSequenceCorrection: true,
        reason: '',
      }),
    ).rejects.toMatchObject({ code: 'SEQUENCE_TOO_LOW' });
  });

  it('allows normal increase at or above the floor', async () => {
    const db = {
      oficio: {
        findMany: vi.fn().mockResolvedValue([{ number: 'CNI-241-2026' }]),
      },
      oficioNumberingConfig: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'cfg-1',
          lastGeneratedSequence: 241,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'cfg-1',
          lastGeneratedSequence: 250,
        }),
      },
    };

    await upsertNumberingConfig(db as never, 'org-a', 'user-1', {
      dependency: 'CNI',
      year: 2026,
      nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
      lastGeneratedSequence: 250,
    });
    expect(db.oficioNumberingConfig.update).toHaveBeenCalled();
  });

  it('E) ensureDefaultNumberingConfigs seeds from highestUsed, not zero', async () => {
    const createdPayloads: Array<{ lastGeneratedSequence: number; dependency: string }> = [];
    const db = {
      oficio: {
        findMany: vi.fn().mockImplementation(({ where }: { where: { scope: string } }) => {
          if (where.scope === 'CNI') return Promise.resolve([{ number: 'CNI-241-2026' }]);
          return Promise.resolve([]);
        }),
      },
      oficioNumberingConfig: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }: { data: { lastGeneratedSequence: number; dependency: string } }) => {
          createdPayloads.push({
            lastGeneratedSequence: data.lastGeneratedSequence,
            dependency: data.dependency,
          });
          return Promise.resolve({
            id: `cfg-${data.dependency}`,
            ...data,
            prefix: data.dependency === 'DESPACHO' ? 'DPICP' : data.dependency === 'INTERNO' ? 'MEMO' : 'CNI',
            sequencePadding: 0,
            notes: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }),
      },
    };

    const results = await ensureDefaultNumberingConfigs(db as never, 'org-a', 'user-1', 2026);
    const cni = createdPayloads.find((p) => p.dependency === 'CNI');
    expect(cni?.lastGeneratedSequence).toBe(241);

    const cniResult = results.find((r) => r.dependency === 'CNI');
    expect(cniResult?.lastGeneratedSequence).toBe(241);
    expect(
      previewNextNumber({
        pattern: 'CNI-{NUMERO}-{AÑO}',
        lastGeneratedSequence: 241,
        year: 2026,
      }),
    ).toBe('CNI-242-2026');
  });

  it('findHighestUsedSequence reads max from document numbers', async () => {
    const db = {
      oficio: {
        findMany: vi.fn().mockResolvedValue([
          { number: 'DPICP-167-2026' },
          { number: 'DPICP-168-2026' },
        ]),
      },
    };
    await expect(
      findHighestUsedSequence(db as never, {
        organizationId: 'org-a',
        dependency: 'DESPACHO',
        year: 2026,
      }),
    ).resolves.toBe(168);
  });
});

describe('oficios.configure authorization for numbering and signers', () => {
  it('SECRETARIA cannot configure', () => {
    const role = organizationRole('SECRETARIA');
    expect(can(role, 'oficios.create')).toBe(true);
    expect(can(role, 'oficios.configure')).toBe(false);
  });

  it('ADMINISTRACION cannot configure', () => {
    const role = organizationRole('ADMINISTRACION');
    expect(can(role, 'oficios.create')).toBe(true);
    expect(can(role, 'oficios.configure')).toBe(false);
  });

  it('IT_MANAGER can configure but cannot create correspondence', () => {
    const role = organizationRole('IT_MANAGER');
    expect(can(role, 'oficios.configure')).toBe(true);
    expect(can(role, 'oficios.create')).toBe(false);
  });

  it('ADMIN can configure and operate', () => {
    const role = organizationRole('ADMIN');
    expect(can(role, 'oficios.create')).toBe(true);
    expect(can(role, 'oficios.configure')).toBe(true);
  });
});

describe('related correspondence selection contract', () => {
  it('stores internal oficio.id as responseToId from a search hit', () => {
    const selected = {
      id: 'oficio_internal_cuid',
      number: 'DPICP-167-2026',
      subject: 'Solicitud de ingreso sin visa',
    };
    const payload = { responseToId: selected.id };
    expect(payload.responseToId).toBe('oficio_internal_cuid');
    expect(payload.responseToId).not.toBe(selected.number);
  });
});
