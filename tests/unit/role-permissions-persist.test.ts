import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '@/platform/api/with-auth';
import { MODULE_CATALOG, type ModuleId } from '@/platform/security/modules';

// In-memory role_permissions table (only what the handlers use).
type Row = { organizationId: string; role: string; permission: string };
const db: { rows: Row[] } = { rows: [] };

const rolePermission = {
  findMany: vi.fn(async ({ where }: { where: { organizationId: string; role?: string } }) =>
    db.rows
      .filter((r) => r.organizationId === where.organizationId && (!where.role || r.role === where.role))
      .map((r) => ({ role: r.role, permission: r.permission })),
  ),
  deleteMany: vi.fn(async ({ where }: { where: { organizationId: string; role: string } }) => {
    const before = db.rows.length;
    db.rows = db.rows.filter((r) => !(r.organizationId === where.organizationId && r.role === where.role));
    return { count: before - db.rows.length };
  }),
  createMany: vi.fn(async ({ data }: { data: Row[] }) => {
    for (const row of data) {
      if (!db.rows.some((r) => r.organizationId === row.organizationId && r.role === row.role && r.permission === row.permission)) {
        db.rows.push(row);
      }
    }
    return { count: data.length };
  }),
};

const prismaFake = {
  rolePermission,
  organization: { update: vi.fn(async () => ({})) },
  organizationMembership: { updateMany: vi.fn(async () => ({ count: 0 })), count: vi.fn(async () => 0) },
  $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaFake)),
};

vi.mock('@/lib/prisma', () => ({ prisma: prismaFake }));
vi.mock('@/platform/security/audit/audit-record', () => ({ createAuditRecord: vi.fn(async () => undefined) }));
vi.mock('@/platform/api/with-auth', () => ({
  withAuth: (handler: (req: AuthenticatedRequest, ctx: unknown) => Promise<Response>) => handler,
}));
vi.mock('@/platform/security/authorization/http', () => ({
  authorizeOrganization: vi.fn(async () => ({ organizationId: 'org-1', userId: 'admin-1', role: 'ADMIN' })),
  authorizationFailure: () => null,
}));

type MatrixRow = {
  module: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  extras: string[];
};

function request(body?: unknown): AuthenticatedRequest {
  return {
    user: { userId: 'admin-1', email: 'a@test', role: 'ADMIN' },
    headers: new Headers(),
    cookies: { get: () => undefined },
    json: async () => body,
  } as unknown as AuthenticatedRequest;
}

async function getMatrix(role: string): Promise<Record<string, MatrixRow>> {
  const { GET } = await import('@/app/api/roles/[role]/permissions/route');
  const res = await GET(request(), { params: Promise.resolve({ role }) });
  expect(res.status).toBe(200);
  return (await res.json()).moduleAccess;
}

async function putMatrix(role: string, matrix: Record<string, MatrixRow>) {
  const { PUT } = await import('@/app/api/roles/[role]/permissions/route');
  const rows = Object.values(matrix).map(({ module, canRead, canCreate, canUpdate, canDelete, extras }) => ({
    module, canRead, canCreate, canUpdate, canDelete, extras,
  }));
  return PUT(request({ rows }), { params: Promise.resolve({ role }) });
}

function permsOf(moduleId: string): string[] {
  const def = MODULE_CATALOG[moduleId as ModuleId];
  return [
    ...Object.values(def.permissionMap).flatMap((list) => list ?? []),
    ...def.specials.map((s) => s.id),
  ];
}

/** A readable module whose permissions are not shared with any other readable module. */
function isolatedReadable(matrix: Record<string, MatrixRow>): string {
  const readable = Object.values(matrix).filter((r) => r.canRead).map((r) => r.module);
  const found = readable.find((m) => {
    const own = new Set(permsOf(m));
    return readable.filter((o) => o !== m).every((o) => permsOf(o).every((p) => !own.has(p)));
  });
  if (!found) throw new Error('No isolated readable module for this role');
  return found;
}

describe('PUT /api/roles/[role]/permissions persists the full matrix', () => {
  beforeEach(() => {
    db.rows = [];
    vi.clearAllMocks();
  });

  it('a removal on a never-materialized role is saved (does not fall back to the official template)', async () => {
    const official = await getMatrix('PROCUREMENT');
    const readable = Object.values(official).filter((r) => r.canRead).map((r) => r.module);
    expect(readable.length).toBeGreaterThan(1);
    const removed = isolatedReadable(official);

    const desired = { ...official, [removed]: { ...official[removed], canRead: false, canCreate: false, canUpdate: false, canDelete: false, extras: [] } };
    const res = await putMatrix('PROCUREMENT', desired);
    expect(res.status).toBe(200);

    const after = await getMatrix('PROCUREMENT');
    expect(after[removed].canRead).toBe(false);
    for (const m of readable.filter((x) => x !== removed)) {
      expect(after[m].canRead, `kept ${m}`).toBe(true);
    }
  });

  it('an addition keeps the rest of the role permissions', async () => {
    const official = await getMatrix('PROCUREMENT');
    const readable = Object.values(official).filter((r) => r.canRead).map((r) => r.module);
    const added = Object.values(official).find(
      (r) => !r.canRead && (MODULE_CATALOG[r.module as ModuleId].permissionMap.read ?? []).length > 0,
    )!.module;

    const desired = { ...official, [added]: { ...official[added], canRead: true } };
    expect((await putMatrix('PROCUREMENT', desired)).status).toBe(200);

    const after = await getMatrix('PROCUREMENT');
    expect(after[added].canRead).toBe(true);
    for (const m of readable) {
      expect(after[m].canRead, `kept ${m}`).toBe(true);
    }
  });

  it('rejects an empty role', async () => {
    const official = await getMatrix('PROCUREMENT');
    const empty = Object.fromEntries(
      Object.entries(official).map(([k, r]) => [k, { ...r, canRead: false, canCreate: false, canUpdate: false, canDelete: false, extras: [] }]),
    );
    expect((await putMatrix('PROCUREMENT', empty)).status).toBe(400);
  });
});
