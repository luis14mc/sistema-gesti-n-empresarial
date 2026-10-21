import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { vi, type Mock } from 'vitest';

/**
 * Golden de plataforma (ADR 003 fase 5).
 *
 * Estas pruebas no se modifican después del commit inicial: entran por puntos
 * de entrada estables (route handlers, `src/actions/auth.ts`, páginas) y solo
 * simulan `@/lib/prisma` y `next/headers`. Para funciones puras que cambian de
 * carpeta durante la fase se usa `importFirst` con la ruta destino primero.
 */

export const REPO = process.cwd();

export function readSource(relativePath: string): string {
  return readFileSync(join(REPO, relativePath), 'utf-8');
}

const FIXTURES_DIR = join(REPO, 'tests/platform-golden/__fixtures__');
const pendingWrites = new Map<string, Record<string, unknown>>();

/**
 * Compara `value` con `__fixtures__/<file>.json[key]`.
 * Solo con GOLDEN_UPDATE=1 se (re)escribe el fixture; en CI siempre compara.
 */
export function expectGolden(file: string, key: string, value: unknown, expectFn: (a: unknown, b: unknown) => void) {
  const path = join(FIXTURES_DIR, `${file}.json`);
  const normalized = JSON.parse(JSON.stringify(value ?? null));
  if (process.env.GOLDEN_UPDATE === '1') {
    const current = pendingWrites.get(path) ?? (existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : {});
    current[key] = normalized;
    pendingWrites.set(path, current);
    mkdirSync(FIXTURES_DIR, { recursive: true });
    writeFileSync(path, `${JSON.stringify(current, null, 2)}\n`);
    return;
  }
  const fixture = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
  expectFn(normalized, fixture[key]);
}

export async function importFirst<T>(candidates: string[]): Promise<T> {
  for (const candidate of candidates) {
    const absolute = resolve(REPO, candidate);
    if (existsSync(absolute)) {
      return (await import(/* @vite-ignore */ absolute)) as T;
    }
  }
  throw new Error(`Ninguna ruta existe: ${candidates.join(', ')}`);
}

type Impl = (...args: any[]) => unknown;

const DEFAULTS: Record<string, Impl> = {
  findUnique: () => null,
  findUniqueOrThrow: () => {
    throw new Error('NOT_FOUND');
  },
  findFirst: () => null,
  findFirstOrThrow: () => {
    throw new Error('NOT_FOUND');
  },
  findMany: () => [],
  count: () => 0,
  groupBy: () => [],
  aggregate: () => ({}),
  create: (args: { data?: Record<string, unknown> }) => ({ id: 'generated-id', ...(args?.data ?? {}) }),
  createMany: () => ({ count: 0 }),
  update: (args: { data?: Record<string, unknown> }) => ({ id: 'updated-id', ...(args?.data ?? {}) }),
  updateMany: () => ({ count: 0 }),
  upsert: (args: { create?: Record<string, unknown> }) => ({ id: 'upserted-id', ...(args?.create ?? {}) }),
  delete: () => ({}),
  deleteMany: () => ({ count: 0 }),
};

export type FakePrisma = {
  client: any;
  calls: Map<string, Mock>;
  on: (key: string, impl: Impl) => void;
  fn: (key: string) => Mock;
  reset: () => void;
};

function createFakePrisma(): FakePrisma {
  const calls = new Map<string, Mock>();

  const fn = (key: string): Mock => {
    let mock = calls.get(key);
    if (!mock) {
      const method = key.split('.').pop() ?? '';
      const fallback = DEFAULTS[method] ?? (() => undefined);
      mock = vi.fn(async (...args: unknown[]) => fallback(...args));
      calls.set(key, mock);
    }
    return mock;
  };

  const models = new Map<string, unknown>();
  const client: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === 'then') return undefined;
        if (prop === '$transaction') {
          return async (arg: unknown) => {
            if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(client);
            return Promise.all(arg as Promise<unknown>[]);
          };
        }
        if (prop === '$queryRaw' || prop === '$executeRaw' || prop === '$queryRawUnsafe' || prop === '$executeRawUnsafe') {
          return fn(prop);
        }
        if (prop.startsWith('$')) return async () => undefined;
        let model = models.get(prop);
        if (!model) {
          model = new Proxy(
            {},
            {
              get(_m, method: string) {
                if (method === 'then') return undefined;
                return fn(`${prop}.${method}`);
              },
            },
          );
          models.set(prop, model);
        }
        return model;
      },
    },
  );

  return {
    client,
    calls,
    fn,
    on: (key, impl) => {
      fn(key).mockImplementation(async (...args: unknown[]) => impl(...args));
    },
    reset: () => {
      calls.clear();
    },
  };
}

export const db = createFakePrisma();

export function prismaModuleMock() {
  return { prisma: db.client, default: db.client };
}

/** Cookie store compatible con `cookies()` de next/headers. */
export class FakeCookieStore {
  readonly values = new Map<string, string>();
  readonly sets: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  get(name: string) {
    const value = this.values.get(name);
    return value === undefined ? undefined : { name, value };
  }

  set(name: string, value: string, options: Record<string, unknown> = {}) {
    this.sets.push({ name, value, options });
    this.values.set(name, value);
  }

  delete(name: string) {
    this.values.delete(name);
  }

  has(name: string) {
    return this.values.has(name);
  }

  getAll() {
    return [...this.values.entries()].map(([name, value]) => ({ name, value }));
  }
}

export const cookieJar = { current: new FakeCookieStore() };

export function nextHeadersMock() {
  return {
    cookies: async () => cookieJar.current,
    headers: async () => new Headers(),
  };
}

export const TEST_JWT_SECRET = 'g'.repeat(48);

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
}

/** Claims comparables: quita los que dependen del reloj o son aleatorios. */
export function stableClaims(token: string): Record<string, unknown> {
  const { iat: _iat, exp: _exp, jti: _jti, ...rest } = decodeJwtPayload(token);
  return rest;
}
