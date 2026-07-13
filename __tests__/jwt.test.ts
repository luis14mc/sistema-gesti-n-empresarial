import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { verifyToken, generateToken } from '../src/lib/auth';

// JWT_SECRET ya viene seteado desde vitest.setup.ts a un valor seguro.
// Forzamos uno determinista para esta suite.
const TEST_SECRET = 'jwt-test-suite-secret-1234567890abc';

describe('JWT — generate/verify', () => {
  let originalSecret: string | undefined;

  beforeAll(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalSecret ?? 'test-secret-key-for-vitest-only';
  });

  it('genera token con 3 partes separadas por punto', () => {
    const token = generateToken({ userId: 'u-1', email: 'a@b.c', role: 'ADMIN' });
    expect(token.split('.').length).toBe(3);
  });

  it('verifyToken retorna el payload firmado correctamente', () => {
    const token = generateToken({ userId: 'u-1', email: 'a@b.c', role: 'IT' });
    const payload = verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.userId).toBe('u-1');
    expect(payload?.email).toBe('a@b.c');
    expect(payload?.role).toBe('IT');
  });

  it('verifyToken retorna null con token firmado con clave distinta', () => {
    // Generamos token con clave distinta
    const oldSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'otro-secret-distinto-1234567890abcdefghij';
    const tokenWithOtherKey = generateToken({ userId: 'u-1', email: 'a@b.c', role: 'ADMIN' });
    process.env.JWT_SECRET = TEST_SECRET;
    // Verificamos con la clave real
    expect(verifyToken(tokenWithOtherKey)).toBeNull();
    process.env.JWT_SECRET = oldSecret;
  });

  it('verifyToken retorna null con firma corrupta', () => {
    const token = generateToken({ userId: 'u-1', email: 'a@b.c', role: 'ADMIN' });
    const [h, p] = token.split('.');
    const tampered = `${h}.${p}.AAAAinvalido`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it('verifyToken retorna null si la estructura no es válida (no JWT)', () => {
    expect(verifyToken('not-a-jwt')).toBeNull();
    expect(verifyToken('one.two')).toBeNull();
    expect(verifyToken('')).toBeNull();
  });
});
