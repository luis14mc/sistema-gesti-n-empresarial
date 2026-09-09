import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
const MIDDLEWARE = resolve(ROOT, 'src/middleware.ts');

const FORBIDDEN = [
  '@prisma/client',
  '@/lib/prisma',
  'PrismaPg',
  'node:util',
  'node:fs',
  'node:path',
  'node:crypto',
  '@/lib/middleware',
  '@/platform/security/authorization/roles',
];

const IMPORT_RE =
  /(?:^|\n)import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;

function resolveImport(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('@/')) {
    return resolve(ROOT, 'src', specifier.slice(2));
  }
  if (specifier.startsWith('.')) {
    return resolve(dirname(fromFile), specifier);
  }
  return null;
}

function loadSource(resolved: string): string | null {
  const candidates = [
    resolved,
    `${resolved}.ts`,
    `${resolved}.tsx`,
    `${resolved}/index.ts`,
  ];
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, 'utf8');
    } catch {
      // try next
    }
  }
  return null;
}

function collectLocalGraph(entry: string): Map<string, string> {
  const visited = new Map<string, string>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    const source = loadSource(file);
    if (!source) continue;
    visited.set(file, source);

    for (const match of source.matchAll(IMPORT_RE)) {
      const specifier = match[1];
      const statement = match[0];
      if (/import\s+type\s/.test(statement)) continue;
      const resolved = resolveImport(file.endsWith('.ts') ? file : `${file}.ts`, specifier);
      if (!resolved) continue;
      queue.push(resolved);
    }
  }

  return visited;
}

describe('middleware Edge import graph', () => {
  it('does not transitively import Node-only or Prisma modules', () => {
    const graph = collectLocalGraph(MIDDLEWARE);
    const files = [...graph.keys()].map((file) => file.replace(`${ROOT}/`, ''));

    expect(files.some((file) => file.endsWith('src/middleware.ts'))).toBe(true);
    expect(files.some((file) => file.includes('session-roles'))).toBe(true);
    expect(files.some((file) => file.includes('authorization/roles'))).toBe(false);
    expect(files.some((file) => file.includes('lib/prisma'))).toBe(false);
    expect(files.some((file) => file.includes('deprecated-api.ts'))).toBe(false);

    const combined = [...graph.values()].join('\n');
    for (const forbidden of FORBIDDEN) {
      expect(combined, `Edge graph must not contain ${forbidden}`).not.toContain(forbidden);
    }
  });
});
