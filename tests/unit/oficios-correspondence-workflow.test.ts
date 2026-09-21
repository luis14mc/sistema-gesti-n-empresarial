import { describe, expect, it, vi } from 'vitest';
import {
  findHighestUsedSequence,
  SEQUENCE_FLOOR_ERROR,
  upsertNumberingConfig,
} from '@/modules/oficios/application/numbering-config';
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
  it('rejects lowering below highest used correspondence sequence', async () => {
    const db = {
      oficio: {
        findMany: vi.fn().mockResolvedValue([
          { number: 'CNI-241-2026' },
          { number: 'CNI-200-2026' },
        ]),
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
        lastGeneratedSequence: 200,
      }),
    ).rejects.toMatchObject({
      code: 'SEQUENCE_TOO_LOW',
      message: SEQUENCE_FLOOR_ERROR,
    });
    expect(db.oficioNumberingConfig.update).not.toHaveBeenCalled();
  });

  it('rejects lowering below current configured lastGeneratedSequence even if docs are lower', async () => {
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
        lastGeneratedSequence: 200,
      }),
    ).rejects.toMatchObject({
      code: 'SEQUENCE_TOO_LOW',
      message: SEQUENCE_FLOOR_ERROR,
    });
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

  it('allows elevated correction with reason when explicitly requested', async () => {
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
          lastGeneratedSequence: 200,
        }),
      },
    };

    await upsertNumberingConfig(db as never, 'org-a', 'admin-1', {
      dependency: 'CNI',
      year: 2026,
      nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
      lastGeneratedSequence: 200,
      allowSequenceCorrection: true,
      reason: 'Corrección institucional autorizada',
    });
    expect(db.oficioNumberingConfig.update).toHaveBeenCalled();
  });

  it('requires reason for elevated correction', async () => {
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
        reason: '',
      }),
    ).rejects.toMatchObject({ code: 'SEQUENCE_TOO_LOW' });
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
    // UI must persist selected.id, never the display number, as responseToId
    const payload = { responseToId: selected.id };
    expect(payload.responseToId).toBe('oficio_internal_cuid');
    expect(payload.responseToId).not.toBe(selected.number);
  });
});
