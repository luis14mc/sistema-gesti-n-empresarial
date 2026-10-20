import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('equipment document file route headers', () => {
  const route = readFileSync('src/app/api/equipment/documents/file/route.ts', 'utf8');

  it('does not send a sandbox CSP (breaks the Chrome PDF viewer)', () => {
    expect(route).not.toMatch(/UPLOAD_FILE_SECURITY_HEADERS/);
    expect(route).not.toMatch(/sandbox['"]/);
  });

  it('keeps nosniff', () => {
    expect(route).toMatch(/'X-Content-Type-Options': 'nosniff'/);
  });
});
