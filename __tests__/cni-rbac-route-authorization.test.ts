import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { OrganizationRole, PermissionEffect } from '@prisma/client';
import type { AuthenticatedRequest } from '@/lib/middleware';

const { overrideStore, prismaMock } = vi.hoisted(() => {
  const store: Array<{ permission: string; effect: PermissionEffect }> = [];
  return {
    overrideStore: store,
    prismaMock: {
      userPermissionOverride: {
        findMany: vi.fn(async ({ where }: { where?: { permission?: string } }) => {
          if (where?.permission) {
            return store.filter((row) => row.permission === where.permission);
          }
          return [...store];
        }),
      },
      equipment: { findFirst: vi.fn().mockResolvedValue(null) },
      employee: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      oficio: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      auditRecord: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
    },
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

vi.mock('@/lib/middleware', () => ({
  withAuth: (handler: unknown) => handler,
}));

vi.mock('@/modules/organizations/application/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/organizations/application/context')>();
  return {
    ...actual,
    requireOrganizationContext: vi.fn(async (req: AuthenticatedRequest) => ({
      authorizationScope: 'organization' as const,
      userId: req.user!.userId,
      organizationId: 'org-1',
      organizationSlug: 'cni',
      timezone: 'America/Tegucigalpa',
      membershipId: 'mem-1',
      role: req.user!.role as OrganizationRole,
    })),
  };
});

vi.mock('@/lib/compras/orden/service', () => ({
  listCompraOrdenes: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 }),
  createCompraOrden: vi.fn(),
}));

vi.mock('@/platform/security/audit/security-events', () => ({
  recordSecurityEventBestEffort: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  createAuditRecord: vi.fn(),
}));

import { GET as getEquipmentById } from '@/app/api/equipment/[id]/route';
import { POST as postEquipmentCollection } from '@/app/api/equipment/route';
import { GET as getEmployees, POST as postEmployees } from '@/app/api/employees/route';
import { GET as getPurchaseOrders, POST as postPurchaseOrders } from '@/app/api/compras/ordenes/route';
import { GET as getUsers } from '@/app/api/users/route';
import { GET as getOficios, POST as postOficios } from '@/app/api/oficios/route';
import { GET as getAuditLogs } from '@/app/api/audit-logs/route';

function request(
  role: OrganizationRole,
  url: string,
  init: ConstructorParameters<typeof NextRequest>[1] = { method: 'GET' },
): AuthenticatedRequest {
  const req = new NextRequest(new URL(url, 'http://localhost'), init) as AuthenticatedRequest;
  req.user = { userId: 'user-1', email: 'user@cni.hn', role };
  return req;
}

function setOverrides(rows: Array<{ permission: string; effect: PermissionEffect }>) {
  overrideStore.splice(0, overrideStore.length, ...rows);
}

beforeEach(() => {
  setOverrides([]);
  prismaMock.equipment.findFirst.mockResolvedValue(null);
});

describe('CNI backend authorization — forbidden access', () => {
  it('SECRETARIA cannot read equipment, employees, purchases or users', async () => {
    const equipment = await getEquipmentById(request('SECRETARIA', 'http://localhost/api/equipment/eq-1'), {
      params: Promise.resolve({ id: 'eq-1' }),
    });
    const employees = await getEmployees(request('SECRETARIA', 'http://localhost/api/employees'));
    const purchases = await getPurchaseOrders(request('SECRETARIA', 'http://localhost/api/compras/ordenes'));
    const users = await getUsers(request('SECRETARIA', 'http://localhost/api/users'));

    expect(equipment.status).toBe(403);
    expect(employees.status).toBe(403);
    expect(purchases.status).toBe(403);
    expect(users.status).toBe(403);
  });

  it('IT_MANAGER cannot read or create oficios, create purchase orders, or create employees', async () => {
    const listOficios = await getOficios(request('IT_MANAGER', 'http://localhost/api/oficios'));
    const createOficio = await postOficios(
      request('IT_MANAGER', 'http://localhost/api/oficios', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    const createOrder = await postPurchaseOrders(
      request('IT_MANAGER', 'http://localhost/api/compras/ordenes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    const createEmployee = await postEmployees(
      request('IT_MANAGER', 'http://localhost/api/employees', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );

    expect(listOficios.status).toBe(403);
    expect(createOficio.status).toBe(403);
    expect(createOrder.status).toBe(403);
    expect(createEmployee.status).toBe(403);
  });

  it('ADMINISTRACION cannot read or create equipment, list users, or read audit logs', async () => {
    const equipment = await getEquipmentById(request('ADMINISTRACION', 'http://localhost/api/equipment/eq-1'), {
      params: Promise.resolve({ id: 'eq-1' }),
    });
    const createEquipment = await postEquipmentCollection(
      request('ADMINISTRACION', 'http://localhost/api/equipment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    const users = await getUsers(request('ADMINISTRACION', 'http://localhost/api/users'));
    const auditLogs = await getAuditLogs(request('ADMINISTRACION', 'http://localhost/api/audit-logs'));

    expect(equipment.status).toBe(403);
    expect(createEquipment.status).toBe(403);
    expect(users.status).toBe(403);
    expect(auditLogs.status).toBe(403);
  });

  it('ADMIN is allowed through the same representative endpoints', async () => {
    const equipment = await getEquipmentById(request('ADMIN', 'http://localhost/api/equipment/eq-1'), {
      params: Promise.resolve({ id: 'eq-1' }),
    });
    const employees = await getEmployees(request('ADMIN', 'http://localhost/api/employees'));
    const purchases = await getPurchaseOrders(request('ADMIN', 'http://localhost/api/compras/ordenes'));
    const users = await getUsers(request('ADMIN', 'http://localhost/api/users'));
    const oficios = await getOficios(request('ADMIN', 'http://localhost/api/oficios'));
    const auditLogs = await getAuditLogs(request('ADMIN', 'http://localhost/api/audit-logs'));

    expect(equipment.status).toBe(404);
    expect(employees.status).toBe(200);
    expect(purchases.status).toBe(200);
    expect(users.status).toBe(200);
    expect(oficios.status).toBe(200);
    expect(auditLogs.status).toBe(200);
  });
});

describe('CNI backend authorization — permission overrides', () => {
  it('DENY removes a role-granted permission on GET /api/equipment/[id]', async () => {
    setOverrides([{ permission: 'equipment.read', effect: 'DENY' }]);
    const response = await getEquipmentById(request('IT_MANAGER', 'http://localhost/api/equipment/eq-1'), {
      params: Promise.resolve({ id: 'eq-1' }),
    });
    expect(response.status).toBe(403);
  });

  it('ALLOW grants a missing permission on GET /api/equipment/[id]', async () => {
    setOverrides([{ permission: 'equipment.read', effect: 'ALLOW' }]);
    const response = await getEquipmentById(request('SECRETARIA', 'http://localhost/api/equipment/eq-1'), {
      params: Promise.resolve({ id: 'eq-1' }),
    });
    expect(response.status).toBe(404);
  });

  it('DENY wins when ALLOW and DENY both exist', async () => {
    setOverrides([
      { permission: 'equipment.read', effect: 'ALLOW' },
      { permission: 'equipment.read', effect: 'DENY' },
    ]);
    const response = await getEquipmentById(request('SECRETARIA', 'http://localhost/api/equipment/eq-1'), {
      params: Promise.resolve({ id: 'eq-1' }),
    });
    expect(response.status).toBe(403);
  });
});
