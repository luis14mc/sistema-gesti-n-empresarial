import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import type { AuthenticatedRequest } from '@/lib/middleware';
import apiGuardsFixture from './__fixtures__/api-guards.json';

const REPO = process.cwd();
const TEST_SECRET = 'a'.repeat(48);

function readRouteSource(relativePath: string): string {
  return readFileSync(join(REPO, relativePath), 'utf-8');
}

function extractAuthorizePermissions(source: string): string[] {
  const re = /authorizeOrganization\s*\(\s*[^,]+,\s*[^,]+,\s*(?:[^,]+,\s*)?'([^']+)'/g;
  const perms: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) perms.push(m[1]);
  return perms;
}

function extractRequireOrganizationPermissions(source: string): string[] {
  const re = /requireOrganizationPermission\s*\([^,]+,\s*[^,]+,\s*[^,]+,\s*'([^']+)'\)/g;
  const perms: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) perms.push(m[1]);
  return perms;
}

describe('RBAC golden — guardas API users / roles / auth/me', () => {
  it('fixture api-guards.json coincide con permisos declarados en route.ts', () => {
    for (const entry of apiGuardsFixture as {
      file: string;
      method: string;
      permission: string | null;
      permissionKind: string;
    }[]) {
      const source = readRouteSource(entry.file);
      if (entry.permission === null) {
        expect(source).toContain('withAuth');
        continue;
      }
      if (entry.permissionKind === 'authorizeOrganization') {
        const declared = extractAuthorizePermissions(source);
        if (declared.length > 0) {
          expect(declared).toContain(entry.permission);
        } else {
          // INCONSISTENCIA: permiso en expresión ternaria (p. ej. GET /api/roles).
          expect(source).toContain(`'${entry.permission}'`);
        }
      } else {
        expect(extractRequireOrganizationPermissions(source)).toContain(entry.permission);
      }
    }
  });

  it('GET /api/roles?assignable=true exige users.read (condicional en código)', () => {
    const source = readRouteSource('src/app/api/roles/route.ts');
    expect(source).toMatch(/assignableOnly \|\| scopeLabels \? 'users\.read' : 'roles\.manage'/);
  });
});

vi.mock('@/lib/session-validity', () => ({
  assertTokenSessionStillValid: vi.fn(async () => true),
}));

function buildRequest(pathname: string, token: string): AuthenticatedRequest {
  const cookies = new Map<string, { value: string }>();
  cookies.set('token', { value: token });
  return {
    headers: new Headers(),
    cookies: { get: (name: string) => cookies.get(name) },
    nextUrl: new URL(`http://localhost:3000${pathname}`),
    url: `http://localhost:3000${pathname}`,
    user: undefined,
  } as unknown as AuthenticatedRequest;
}

function signMustChangeToken() {
  return jwt.sign(
    { userId: 'u-1', email: 'u@test', role: 'ADMIN', jti: 'j', mustChangePassword: true },
    TEST_SECRET,
    { algorithm: 'HS256', expiresIn: '5m', issuer: 'sge', audience: 'sge-web' },
  );
}

describe('RBAC golden — PASSWORD_CHANGE_REQUIRED en APIs', () => {
  let previousSecret: string | undefined;

  beforeEach(() => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const allowedPaths = [
    '/api/auth/me',
    '/api/auth/password',
    '/api/auth/refresh-session',
    '/api/auth/logout',
  ];

  for (const path of allowedPaths) {
    it(`${path} permitido con mustChangePassword`, async () => {
      const { withAuth } = await import('@/lib/middleware');
      const handler = withAuth(async () => NextResponse.json({ ok: true }));
      const res = await handler(buildRequest(path, signMustChangeToken()));
      expect(res.status).toBe(200);
    });
  }

  it('/api/users responde 403 PASSWORD_CHANGE_REQUIRED con mustChangePassword', async () => {
    const { withAuth } = await import('@/lib/middleware');
    const handler = withAuth(async () => NextResponse.json({ ok: true }));
    const res = await handler(buildRequest('/api/users', signMustChangeToken()));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });
});
