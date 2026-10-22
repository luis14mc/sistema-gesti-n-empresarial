import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieJar, db, expectGolden, FakeCookieStore, stableClaims, TEST_JWT_SECRET } from './_helpers';

vi.mock('@/lib/prisma', async () => (await import('./_helpers')).prismaModuleMock());
vi.mock('next/headers', async () => (await import('./_helpers')).nextHeadersMock());

const actions = await import('@/actions/auth');
const registerRoute = await import('@/app/api/auth/register/route');
const meRoute = await import('@/app/api/auth/me/route');

const PASSWORD = 'Valid-Pass-2026!';
const HASH = bcrypt.hashSync(PASSWORD, 4);

function signToken(claims: Record<string, unknown>) {
  return jwt.sign({ email: 'golden@cni.hn', ...claims }, TEST_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
    issuer: 'sge',
    audience: 'sge-web',
  });
}

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-golden',
    employeeNumber: 'CNI-G-1',
    email: 'golden@cni.hn',
    password: HASH,
    firstName: 'Gold',
    lastName: 'En',
    phone: null,
    role: 'ADMIN',
    isActive: true,
    departmentId: null,
    positionId: null,
    department: null,
    position: null,
    mustChangePassword: false,
    passwordChangedAt: null,
    ...overrides,
  };
}

function activeSession(u = baseUser(), membershipRole: string | null = 'ADMIN') {
  db.on('user.findUnique', (args: { where: { email?: string } }) => {
    if (args.where.email && args.where.email !== u.email) return null;
    return u;
  });
  db.on('organizationMembership.findFirst', () =>
    membershipRole ? { role: membershipRole, organizationId: 'org_cni_default' } : null,
  );
  db.on('organizationMembership.findUnique', () => ({ role: membershipRole, accessVersion: 0, status: 'ACTIVE' }));
}

function apiRequest(path: string, init: { token?: string; bearer?: boolean; body?: unknown; method?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.token && init.bearer) headers.authorization = `Bearer ${init.token}`;
  if (init.token && !init.bearer) headers.cookie = `token=${init.token}`;
  return new NextRequest(`http://localhost${path}`, {
    method: init.method ?? 'POST',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function summarize(res: Response) {
  const body = await res.json().catch(() => null);
  return {
    status: res.status,
    hasRequestIdHeader: res.headers.get('x-request-id') !== null,
    body: body && typeof body === 'object' && 'requestId' in body ? { ...body, requestId: '<uuid>' } : body,
  };
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
  cookieJar.current = new FakeCookieStore();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('platform golden — actions/auth.ts', () => {
  it('loginAction: éxito, cookie emitida con flags y auditoría', async () => {
    activeSession();
    const result = await actions.loginAction({ email: 'golden@cni.hn', password: PASSWORD });
    const cookie = cookieJar.current.sets[0];
    const audit = db.fn('auditRecord.create').mock.calls.map(([args]) => {
      const { title, description, module, category, userId } = (args as { data: Record<string, unknown> }).data;
      return { title, description, module, category, userId };
    });
    expectGolden(
      'auth-session',
      'loginActionSuccess',
      {
        result: { ...result, data: result.success ? { ...result.data } : undefined },
        cookie: { name: cookie.name, options: cookie.options, claims: stableClaims(cookie.value) },
        audit,
      },
      (a, b) => expect(a).toEqual(b),
    );
  });

  it('loginAction: errores', async () => {
    activeSession(baseUser({ isActive: false }));
    const inactive = await actions.loginAction({ email: 'golden@cni.hn', password: PASSWORD });
    activeSession();
    const wrong = await actions.loginAction({ email: 'golden@cni.hn', password: 'otra-clave-123' });
    const unknown = await actions.loginAction({ email: 'nadie@cni.hn', password: PASSWORD });
    const invalid = await actions.loginAction({ email: 'x', password: '' });
    expectGolden(
      'auth-session',
      'loginActionErrors',
      { inactive, wrong, unknown, invalid, cookieSets: cookieJar.current.sets.length },
      (a, b) => expect(a).toEqual(b),
    );
  });

  it('logoutAction limpia la cookie', async () => {
    await actions.logoutAction();
    expectGolden('auth-session', 'logoutAction', cookieJar.current.sets, (a, b) => expect(a).toEqual(b));
  });

  it('registerAction: rol permitido, duplicado y datos inválidos', async () => {
    const admin = baseUser();
    activeSession(admin);
    cookieJar.current.values.set('token', signToken({ userId: admin.id, role: 'ADMIN' }));

    db.on('user.findFirst', () => null);
    db.on('user.create', (args: { data: Record<string, unknown> }) => ({
      ...baseUser({ id: 'new-user', role: 'USER', password: undefined }),
      email: args.data.email,
      employeeNumber: args.data.employeeNumber,
      firstName: args.data.firstName,
      lastName: args.data.lastName,
    }));
    const created = await actions.registerAction({
      employeeNumber: 'CNI-NEW-1',
      email: 'nuevo@cni.hn',
      password: 'Nueva-Clave-2026!',
      firstName: 'Nuevo',
      lastName: 'Usuario',
    });
    const createArgs = db.fn('user.create').mock.calls[0]?.[0] as { data: Record<string, unknown> } | undefined;
    const createdCookie = cookieJar.current.sets.at(-1);

    db.on('user.findFirst', () => ({ email: 'nuevo@cni.hn', employeeNumber: 'OTRO' }));
    const duplicateEmail = await actions.registerAction({
      employeeNumber: 'CNI-NEW-2',
      email: 'nuevo@cni.hn',
      password: 'Nueva-Clave-2026!',
      firstName: 'Nuevo',
      lastName: 'Usuario',
    });
    db.on('user.findFirst', () => ({ email: 'otro@cni.hn', employeeNumber: 'CNI-NEW-2' }));
    const duplicateEmployee = await actions.registerAction({
      employeeNumber: 'CNI-NEW-2',
      email: 'nuevo2@cni.hn',
      password: 'Nueva-Clave-2026!',
      firstName: 'Nuevo',
      lastName: 'Usuario',
    });
    const invalid = await actions.registerAction({
      employeeNumber: '',
      email: 'no-email',
      password: '1',
      firstName: '',
      lastName: '',
    });

    expectGolden(
      'auth-session',
      'registerAction',
      {
        created,
        createData: createArgs
          ? { ...createArgs.data, password: typeof createArgs.data.password === 'string' && createArgs.data.password !== 'Nueva-Clave-2026!' ? '<hash>' : createArgs.data.password }
          : null,
        createdCookie: createdCookie ? { name: createdCookie.name, options: createdCookie.options, claims: stableClaims(createdCookie.value) } : null,
        duplicateEmail,
        duplicateEmployee,
        invalid,
      },
      (a, b) => expect(a).toEqual(b),
    );
  });

  it('registerAction: rol no permitido redirige a /forbidden', async () => {
    const u = baseUser({ role: 'USER' });
    activeSession(u, 'USER');
    cookieJar.current.values.set('token', signToken({ userId: u.id, role: 'USER' }));
    const error = await actions
      .registerAction({ employeeNumber: 'X-1', email: 'x@cni.hn', password: 'Clave-Larga-2026!', firstName: 'X', lastName: 'Y' })
      .then(() => null)
      .catch((e: unknown) => (e as { digest?: string }).digest ?? String(e));
    expectGolden('auth-session', 'registerActionForbidden', String(error).split(';').slice(0, 3), (a, b) =>
      expect(a).toEqual(b),
    );
  });
});

describe('platform golden — POST /api/auth/register', () => {
  it('éxito, duplicado, inválido y auditoría', async () => {
    const admin = baseUser();
    activeSession(admin);
    const token = signToken({ userId: admin.id, role: 'ADMIN' });

    db.on('user.findFirst', () => null);
    db.on('user.create', (args: { data: Record<string, unknown> }) => ({
      id: 'new-user',
      ...args.data,
      password: 'stored-hash',
      phone: null,
      isActive: true,
    }));
    const ok = await registerRoute.POST(
      apiRequest('/api/auth/register', {
        token,
        body: { employeeNumber: 'CNI-NEW-1', email: 'nuevo@cni.hn', password: 'Nueva-Clave-2026!', firstName: 'Nuevo', lastName: 'Usuario' },
      }),
    );
    const audit = db.fn('auditRecord.create').mock.calls.map(([args]) => {
      const { title, description, module, category, userId, entityId, newData } = (args as { data: Record<string, unknown> }).data;
      return { title, description, module, category, userId, entityId, newData };
    });

    db.on('user.findFirst', () => ({ id: 'dup' }));
    const dup = await registerRoute.POST(
      apiRequest('/api/auth/register', {
        token,
        body: { employeeNumber: 'CNI-NEW-1', email: 'nuevo@cni.hn', password: 'Nueva-Clave-2026!', firstName: 'Nuevo', lastName: 'Usuario' },
      }),
    );
    const invalid = await registerRoute.POST(apiRequest('/api/auth/register', { token, body: { email: 'x' } }));
    const invalidBody = await invalid.json();

    db.on('user.findFirst', () => {
      throw new Error('db down');
    });
    const failure = await registerRoute.POST(
      apiRequest('/api/auth/register', {
        token,
        body: { employeeNumber: 'CNI-NEW-9', email: 'nuevo9@cni.hn', password: 'Nueva-Clave-2026!', firstName: 'Nuevo', lastName: 'Usuario' },
      }),
    );

    expectGolden(
      'auth-session',
      'registerRoute',
      {
        ok: await summarize(ok),
        audit,
        dup: await summarize(dup),
        invalid: { status: invalid.status, error: invalidBody.error, hasDetails: 'details' in invalidBody },
        failure: await summarize(failure),
      },
      (a, b) => expect(a).toEqual(b),
    );
  });
});

describe('platform golden — withAuth', () => {
  it('401 sin token, token inválido, SESSION_REVOKED, PASSWORD_CHANGE_REQUIRED y 403 por rol', async () => {
    const admin = baseUser();
    activeSession(admin);

    const noToken = await registerRoute.POST(apiRequest('/api/auth/register', { body: {} }));
    const badToken = await registerRoute.POST(apiRequest('/api/auth/register', { token: 'not-a-jwt', body: {} }));
    const wrongSecret = await registerRoute.POST(
      apiRequest('/api/auth/register', {
        token: jwt.sign({ userId: 'u', email: 'e@x.hn', role: 'ADMIN' }, 'z'.repeat(48), { issuer: 'sge', audience: 'sge-web' }),
        body: {},
      }),
    );

    activeSession(baseUser({ isActive: false }));
    const revokedInactive = await registerRoute.POST(
      apiRequest('/api/auth/register', { token: signToken({ userId: admin.id, role: 'ADMIN' }), body: {} }),
    );

    activeSession(baseUser({ passwordChangedAt: new Date(Date.now() + 60_000) }));
    const revokedPassword = await registerRoute.POST(
      apiRequest('/api/auth/register', { token: signToken({ userId: admin.id, role: 'ADMIN', pwdChangedAtMs: 1 }), body: {} }),
    );

    activeSession();
    const mustChangeToken = signToken({ userId: admin.id, role: 'ADMIN', mustChangePassword: true });
    const mustChangeBlocked = await registerRoute.POST(apiRequest('/api/auth/register', { token: mustChangeToken, body: {} }));
    const mustChangeAllowed = await meRoute.GET(apiRequest('/api/auth/me', { token: mustChangeToken, method: 'GET' }));

    const userToken = signToken({ userId: admin.id, role: 'USER' });
    const forbiddenRole = await registerRoute.POST(apiRequest('/api/auth/register', { token: userToken, body: {} }));
    const bearerForbidden = await registerRoute.POST(
      apiRequest('/api/auth/register', { token: userToken, bearer: true, body: {} }),
    );

    expectGolden(
      'auth-session',
      'withAuth',
      {
        noToken: await summarize(noToken),
        badToken: await summarize(badToken),
        wrongSecret: await summarize(wrongSecret),
        revokedInactive: await summarize(revokedInactive),
        revokedPassword: await summarize(revokedPassword),
        mustChangeBlocked: await summarize(mustChangeBlocked),
        mustChangeAllowedStatusIsNot403: mustChangeAllowed.status !== 403,
        forbiddenRole: await summarize(forbiddenRole),
        bearerForbidden: await summarize(bearerForbidden),
      },
      (a, b) => expect(a).toEqual(b),
    );
  });
});
