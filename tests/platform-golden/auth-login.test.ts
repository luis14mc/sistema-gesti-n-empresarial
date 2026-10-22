import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, expectGolden, prismaModuleMock, stableClaims, TEST_JWT_SECRET } from './_helpers';

vi.mock('@/lib/prisma', async () => (await import('./_helpers')).prismaModuleMock());

const { POST } = await import('@/app/api/auth/login/route');
const { postLoginPath } = await import('@/platform/security/authorization/roles');
const { postLoginPathForRole } = await import('@/middleware');

void prismaModuleMock;

const PASSWORD = 'Valid-Pass-2026!';
const HASH = bcrypt.hashSync(PASSWORD, 4);

let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `10.20.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`;
}

function loginRequest(body: unknown, ip = nextIp(), raw?: string) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: raw ?? JSON.stringify(body),
  });
}

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-golden',
    email: 'golden@cni.hn',
    password: HASH,
    firstName: 'Gold',
    lastName: 'En',
    role: 'ADMIN',
    isActive: true,
    employeeNumber: 'CNI-G-1',
    phone: null,
    departmentId: null,
    positionId: null,
    mustChangePassword: false,
    passwordChangedAt: null,
    ...overrides,
  };
}

function setupUser(u: ReturnType<typeof user>, membershipRole: string | null) {
  db.on('user.findUnique', (args: { where: { id?: string; email?: string } }) => {
    if (args.where.email && args.where.email !== u.email) return null;
    return u;
  });
  db.on('organizationMembership.findFirst', () =>
    membershipRole ? { role: membershipRole, organizationId: 'org_cni_default' } : null,
  );
  db.on('organizationMembership.findUnique', () =>
    membershipRole ? { role: membershipRole, accessVersion: 3, status: 'ACTIVE' } : null,
  );
}

let previousSecret: string | undefined;
beforeAll(() => {
  previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = TEST_JWT_SECRET;
});
afterAll(() => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});
beforeEach(() => {
  db.reset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

async function summarize(res: Response) {
  const body = await res.json();
  return {
    status: res.status,
    rateLimit: {
      limit: res.headers.get('X-RateLimit-Limit'),
      remaining: res.headers.get('X-RateLimit-Remaining'),
    },
    retryAfterPresent: res.headers.get('Retry-After') !== null,
    body: {
      ...body,
      ...(body.token ? { token: '<jwt>' } : {}),
      ...(typeof body.retryAfterMs === 'number' ? { retryAfterMs: '<ms>' } : {}),
    },
  };
}

describe('platform golden — POST /api/auth/login', () => {
  it('credenciales válidas', async () => {
    setupUser(user(), 'ADMIN');
    const res = await POST(loginRequest({ email: 'golden@cni.hn', password: PASSWORD }));
    expectGolden('auth-login', 'valid', await summarize(res), (a, b) => expect(a).toEqual(b));
  });

  it('password incorrecto + auditoría del intento fallido', async () => {
    setupUser(user(), 'ADMIN');
    const res = await POST(loginRequest({ email: 'golden@cni.hn', password: 'wrong-pass-123' }, '10.99.0.1'));
    const audit = db.fn('auditRecord.create').mock.calls.map(([args]) => {
      const { title, description, module, category, organizationId } = (args as { data: Record<string, unknown> }).data;
      return { title, description, module, category, organizationId };
    });
    expectGolden('auth-login', 'wrongPassword', { response: await summarize(res), audit }, (a, b) => expect(a).toEqual(b));
  });

  it('usuario inexistente', async () => {
    setupUser(user(), 'ADMIN');
    const res = await POST(loginRequest({ email: 'nadie@cni.hn', password: PASSWORD }));
    expectGolden('auth-login', 'unknownUser', await summarize(res), (a, b) => expect(a).toEqual(b));
  });

  it('cuenta inactiva', async () => {
    setupUser(user({ isActive: false }), 'ADMIN');
    const res = await POST(loginRequest({ email: 'golden@cni.hn', password: PASSWORD }));
    expectGolden('auth-login', 'inactive', await summarize(res), (a, b) => expect(a).toEqual(b));
  });

  it('payload inválido', async () => {
    const res = await POST(loginRequest({ email: 'no-es-email', password: '' }));
    expectGolden('auth-login', 'invalidPayload', await summarize(res), (a, b) => expect(a).toEqual(b));
  });

  it('límite por IP (429)', async () => {
    const ip = '10.77.0.1';
    const statuses: number[] = [];
    let last: Response | null = null;
    for (let i = 0; i < 6; i += 1) {
      last = await POST(loginRequest(null, ip, '{not-json'));
      statuses.push(last.status);
    }
    const audit = db.fn('auditRecord.create').mock.calls.length;
    expectGolden(
      'auth-login',
      'ipRateLimit',
      { statuses, last: await summarize(last!), auditCreateCalls: audit },
      (a, b) => expect(a).toEqual(b),
    );
  });

  it('límite por cuenta (429) aunque cambie la IP', async () => {
    const email = 'cuenta-limite@cni.hn';
    setupUser(user({ email }), 'ADMIN');
    const statuses: number[] = [];
    let last: Response | null = null;
    for (let i = 0; i < 11; i += 1) {
      last = await POST(loginRequest({ email, password: PASSWORD }));
      statuses.push(last.status);
    }
    expectGolden('auth-login', 'accountRateLimit', { statuses, last: await summarize(last!) }, (a, b) =>
      expect(a).toEqual(b),
    );
  });

  it('claims del JWT por rol', async () => {
    const roles = ['OWNER', 'ADMIN', 'SECRETARIA', 'IT_MANAGER', 'PROCUREMENT', 'HR', 'AUDITOR', 'USER'];
    const claims: Record<string, unknown> = {};
    for (const role of roles) {
      setupUser(
        user({
          id: `user-${role.toLowerCase()}`,
          email: `${role.toLowerCase()}@cni.hn`,
          mustChangePassword: role === 'USER',
          passwordChangedAt: new Date('2026-09-01T12:00:00.000Z'),
        }),
        role,
      );
      const res = await POST(loginRequest({ email: `${role.toLowerCase()}@cni.hn`, password: PASSWORD }));
      const body = await res.json();
      claims[role] = { status: res.status, sessionRole: body.user?.role, claims: stableClaims(body.token) };
    }
    expectGolden('auth-login', 'jwtClaimsByRole', claims, (a, b) => expect(a).toEqual(b));
  });

  it('landing según rol y mustChangePassword', () => {
    const roles = ['OWNER', 'ADMIN', 'SECRETARIA', 'USER', 'AUDITOR'];
    const landing: Record<string, unknown> = {};
    for (const role of roles) {
      landing[role] = {
        client: postLoginPath(role),
        clientMustChange: postLoginPath(role, true),
        edge: postLoginPathForRole(role),
        edgeMustChange: postLoginPathForRole(role, true),
      };
    }
    expectGolden('auth-login', 'landing', landing, (a, b) => expect(a).toEqual(b));
  });
});
