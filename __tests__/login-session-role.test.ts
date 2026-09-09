import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { findUnique, findFirst, comparePassword, createAuditRecord } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  comparePassword: vi.fn(),
  createAuditRecord: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique },
    organizationMembership: { findFirst },
  },
}));

vi.mock('@/lib/audit', () => ({
  createAuditRecord,
}));

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    comparePassword,
  };
});

import { POST } from '@/app/api/auth/login/route';

const TEST_SECRET = 'a'.repeat(48);

const activeUser = {
  id: 'user-1',
  email: 'soporte@cni.hn',
  password: 'hashed-password',
  firstName: 'Soporte',
  lastName: 'IT',
  role: 'ADMIN' as const,
  isActive: true,
  employeeNumber: 'CNI-IT-ADMIN',
  phone: null,
  departmentId: null,
  positionId: null,
};

function loginRequest(body: unknown) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login — session role robustness', () => {
  let previousSecret: string | undefined;

  beforeEach(() => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
    findUnique.mockReset();
    findFirst.mockReset();
    comparePassword.mockReset();
    createAuditRecord.mockReset().mockResolvedValue({ id: 'audit-1' });
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('returns successful authentication with fallback role when membership lookup fails', async () => {
    findUnique.mockResolvedValue(activeUser);
    comparePassword.mockResolvedValue(true);
    findFirst.mockRejectedValue(new Error('column OrganizationMembership.role does not exist'));

    const response = await POST(loginRequest({ email: activeUser.email, password: 'valid-password' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user.role).toBe('ADMIN');
    expect(payload.token).toEqual(expect.any(String));
    expect(payload.user).not.toHaveProperty('password');
  });

  it('returns 200 when successful login audit logging fails', async () => {
    findUnique.mockResolvedValue(activeUser);
    comparePassword.mockResolvedValue(true);
    findFirst.mockResolvedValue({ role: 'ADMIN' });
    createAuditRecord.mockRejectedValue(new Error('No se pudo crear el registro de auditoría. Operación abortada.'));

    const response = await POST(loginRequest({ email: activeUser.email, password: 'valid-password' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.user.role).toBe('ADMIN');
    expect(payload.token).toEqual(expect.any(String));
  });

  it('returns 401 for an invalid password', async () => {
    findUnique.mockResolvedValue(activeUser);
    comparePassword.mockResolvedValue(false);

    const response = await POST(loginRequest({ email: activeUser.email, password: 'wrong-password' }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe('Credenciales inválidas');
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns 403 for an inactive user', async () => {
    findUnique.mockResolvedValue({ ...activeUser, isActive: false });

    const response = await POST(loginRequest({ email: activeUser.email, password: 'valid-password' }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe('Usuario inactivo');
    expect(comparePassword).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
