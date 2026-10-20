import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('forced password change does not loop', () => {
  it('/api/auth/password issues the new session cookie in the same response', () => {
    const route = read('src/app/api/auth/password/route.ts');
    expect(route).toMatch(/generateSessionToken\(/);
    expect(route).toMatch(/res\.cookies\.set\('token'/);
  });

  it('the change-password page does not depend on refresh-session with a revoked token', () => {
    const page = read('src/app/settings/cambiar-contrasena/page.tsx');
    expect(page).not.toMatch(/refresh-session/);
    expect(page).toMatch(/window\.location\.assign\('\/dashboard'\)/);
  });

  it('MainLayout clears the revoked cookie before going to /login', () => {
    const layout = read('src/components/layout/MainLayout.tsx');
    expect(layout).toMatch(/r\.status === 401\) \{[\s\S]*?await logoutAction\(\)/);
  });
});
