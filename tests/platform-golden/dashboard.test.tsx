import jwt from 'jsonwebtoken';
import { isValidElement, type ReactElement } from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cookieJar, db, expectGolden, FakeCookieStore, TEST_JWT_SECRET } from './_helpers';

vi.mock('@/lib/prisma', async () => (await import('./_helpers')).prismaModuleMock());
vi.mock('next/headers', async () => (await import('./_helpers')).nextHeadersMock());

const { default: DashboardPage } = await import('@/app/dashboard/page');

const COUNTS: Array<[string, (args?: { where?: Record<string, unknown> }) => boolean, number]> = [
  ['oficio.count', (args) => !args?.where, 120],
  ['oficio.count', (args) => Boolean(args?.where?.status), 17],
  ['equipment.count', (args) => !args?.where, 250],
  ['equipment.count', (args) => (args?.where as { status?: string } | undefined)?.status === 'AVAILABLE', 64],
  ['equipmentAssignment.count', () => true, 171],
  ['compraOrden.count', () => true, 9],
  ['user.count', () => true, 58],
];

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
});

function findProps(node: unknown, predicate: (props: Record<string, unknown>) => boolean): Record<string, unknown> | null {
  if (!isValidElement(node)) return null;
  const props = (node as ReactElement<Record<string, unknown>>).props;
  if (predicate(props)) return props;
  const children = props.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findProps(child, predicate);
    if (found) return found;
  }
  return null;
}

describe('platform golden — dashboard KPIs', () => {
  it('stats, oficios recientes y consultas', async () => {
    cookieJar.current.values.set(
      'token',
      jwt.sign({ userId: 'user-sec', email: 'sec@cni.hn', role: 'SECRETARIA' }, TEST_JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h',
        issuer: 'sge',
        audience: 'sge-web',
      }),
    );
    db.on('user.findUnique', () => ({
      id: 'user-sec',
      employeeNumber: 'CNI-S-1',
      email: 'sec@cni.hn',
      firstName: 'Sara',
      lastName: 'Ríos',
      phone: null,
      role: 'USER',
      isActive: true,
      departmentId: null,
      positionId: null,
      department: null,
      position: null,
    }));
    db.on('organizationMembership.findFirst', () => ({ role: 'SECRETARIA' }));
    for (const model of ['oficio', 'equipment', 'equipmentAssignment', 'compraOrden', 'user']) {
      db.on(`${model}.count`, (args?: { where?: Record<string, unknown> }) => {
        const match = COUNTS.find(([key, pred]) => key === `${model}.count` && pred(args));
        return match ? match[2] : -1;
      });
    }
    db.on('oficio.findMany', () => [
      { id: 'of-1', number: 'CNI-OF-001-2026', subject: 'Asunto 1', status: 'SENT', type: 'OUTGOING', createdAt: new Date('2026-10-01T10:00:00.000Z') },
      { id: 'of-2', number: 'CNI-IN-002-2026', subject: 'Asunto 2', status: 'RECEIVED', type: 'INCOMING', createdAt: new Date('2026-09-30T10:00:00.000Z') },
    ]);

    const element = await DashboardPage();
    const layout = findProps(element, (p) => 'user' in p);
    const content = findProps(element, (p) => 'stats' in p);
    const queries: Record<string, unknown[]> = {};
    for (const key of ['oficio.count', 'equipment.count', 'equipmentAssignment.count', 'compraOrden.count', 'user.count', 'oficio.findMany']) {
      queries[key] = db.fn(key).mock.calls.map(([args]) => args ?? null);
    }
    expectGolden(
      'dashboard',
      'kpis',
      {
        layoutUser: layout ? { id: (layout.user as { id: string }).id, role: (layout.user as { role: string }).role } : null,
        stats: content?.stats,
        userName: content?.userName,
        role: content?.role,
        recentOficios: content?.recentOficios,
        queries,
      },
      (a, b) => expect(a).toEqual(b),
    );
  });
});
