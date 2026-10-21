import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { validateRtn } from '@/modules/purchases/domain/rtn-validation';
import { createProveedorSchema, updateProveedorSchema } from '@/modules/purchases/presentation/legacy-schemas';
import fixture from './__fixtures__/suppliers.json';

describe('purchases golden — proveedores', () => {
  it('validación RTN (validation.ts)', () => {
    for (const rtn of fixture.rtnValidation.valid) {
      expect(validateRtn(rtn)).toBe(true);
    }
    for (const rtn of fixture.rtnValidation.invalid) {
      expect(validateRtn(rtn)).toBe(false);
    }
  });

  it('createProveedorSchema: nombre y email', () => {
    const badName = createProveedorSchema.safeParse({ nombreRazonSocial: 'A' });
    expect(badName.success).toBe(false);
    if (!badName.success) {
      expect(badName.error.issues.some((i) => i.message.includes('2'))).toBe(true);
    }

    const badEmail = createProveedorSchema.safeParse({
      nombreRazonSocial: 'Proveedor Golden SA',
      email: 'not-an-email',
    });
    expect(badEmail.success).toBe(false);
  });

  it('updateProveedorSchema acepta parcial', () => {
    const ok = updateProveedorSchema.safeParse({ activo: false });
    expect(ok.success).toBe(true);
  });

  it('mensajes HTTP documentados en rutas proveedores', () => {
    expect(fixture.httpResponses.invalidRtnBody).toBe('RTN inválido (14 dígitos)');
    expect(fixture.httpResponses.duplicateRtnBody).toBe(
      'Ya existe un proveedor con ese RTN en la organización',
    );
    expect(fixture.httpResponses.notFoundBody).toBe('Proveedor no encontrado');
    expect(fixture.httpResponses.hasDependenciesBody).toBe(
      'No se puede eliminar: el proveedor tiene órdenes o solicitudes asociadas',
    );
  });

  it('código Prisma duplicado (PATCH proveedor)', () => {
    expect(fixture.duplicateErrorCode).toBe('P2002');
    expect(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }).code,
    ).toBe(fixture.duplicateErrorCode);
  });
});
