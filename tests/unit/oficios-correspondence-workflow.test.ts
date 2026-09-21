import { describe, expect, it, vi } from 'vitest';
import {
  findHighestUsedSequence,
  upsertNumberingConfig,
} from '@/modules/oficios/application/numbering-config';
import { can, organizationRole } from '@/platform/security/authorization/permissions';

describe('numbering config safety', () => {
  it('rejects lowering lastGeneratedSequence below highest used', async () => {
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
      message: 'El correlativo no puede ser menor al último número ya utilizado.',
    });
    expect(db.oficioNumberingConfig.update).not.toHaveBeenCalled();
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

  it('allows setting sequence at or above highest used', async () => {
    const db = {
      oficio: {
        findMany: vi.fn().mockResolvedValue([{ number: 'CNI-241-2026' }]),
      },
      oficioNumberingConfig: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'cfg-new',
          dependency: 'CNI',
          year: 2026,
          lastGeneratedSequence: 241,
        }),
      },
    };

    await upsertNumberingConfig(db as never, 'org-a', 'user-1', {
      dependency: 'CNI',
      year: 2026,
      nomenclaturePattern: 'CNI-{NUMERO}-{AÑO}',
      lastGeneratedSequence: 241,
    });
    expect(db.oficioNumberingConfig.create).toHaveBeenCalled();
  });
});

describe('oficios.configure authorization', () => {
  it('SECRETARIA can operate correspondence but not configure numbering', () => {
    const role = organizationRole('SECRETARIA');
    expect(can(role, 'oficios.create')).toBe(true);
    expect(can(role, 'oficios.update')).toBe(true);
    expect(can(role, 'oficios.configure')).toBe(false);
  });

  it('ADMINISTRACION can operate correspondence but not configure numbering', () => {
    const role = organizationRole('ADMINISTRACION');
    expect(can(role, 'oficios.create')).toBe(true);
    expect(can(role, 'oficios.configure')).toBe(false);
  });

  it('IT_MANAGER can configure numbering but cannot create correspondence', () => {
    const role = organizationRole('IT_MANAGER');
    expect(can(role, 'oficios.configure')).toBe(true);
    expect(can(role, 'oficios.create')).toBe(false);
  });

  it('ADMIN has full correspondence and configure access', () => {
    const role = organizationRole('ADMIN');
    expect(can(role, 'oficios.create')).toBe(true);
    expect(can(role, 'oficios.configure')).toBe(true);
  });
});
