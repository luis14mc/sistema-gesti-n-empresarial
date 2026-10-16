import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');

function readRoute(relative: string): string {
  return readFileSync(resolve(ROOT, relative), 'utf8');
}

describe('users admin routes (contracts)', () => {
  it('POST /api/users/[id]/password uses users.update and audit without password', () => {
    const src = readRoute('src/app/api/users/[id]/password/route.ts');
    expect(src).toMatch(/authorizeOrganization\(req, requestId, 'users\.update'\)/);
    expect(src).toMatch(/PASSWORD_RESET_BY_ADMIN/);
    expect(src).toMatch(/newData:[\s\S]*mustChangePassword/);
    expect(src).not.toMatch(/newData:[\s\S]*newPassword/);
    expect(src).toMatch(/accessVersion/);
  });

  it('DELETE /api/users/[id] supports hard delete with reference guard', () => {
    const src = readRoute('src/app/api/users/[id]/route.ts');
    expect(src).toMatch(/get\('hard'\) === 'true'/);
    expect(src).toMatch(/countBlockingUserReferences/);
    expect(src).toMatch(/Tiene historial; desactívelo en su lugar/);
  });
});
