import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateToken,
  verifyToken,
} from '../src/lib/auth';
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
  VALID_ROLES,
  validateTokenClaims,
  type Role,
} from '../src/lib/jwt-config';

const TEST_SECRET = 'a'.repeat(48);

describe('S2 Auth hardening — JWT validación estricta', () => {
  let previousSecret: string | undefined;

  beforeEach(() => {
    previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  describe('Constantes de configuración (single source of truth)', () => {
    it('algoritmo único es HS256', () => {
      expect(JWT_ALGORITHM).toBe('HS256');
    });

    it('issuer es "sge"', () => {
      expect(JWT_ISSUER).toBe('sge');
    });

    it('audience es "sge-web"', () => {
      expect(JWT_AUDIENCE).toBe('sge-web');
    });

    it('roles válidos son solo ADMIN/USER/RRHH/IT', () => {
      expect(VALID_ROLES.size).toBe(4);
      expect(VALID_ROLES.has('ADMIN')).toBe(true);
      expect(VALID_ROLES.has('USER')).toBe(true);
      expect(VALID_ROLES.has('RRHH')).toBe(true);
      expect(VALID_ROLES.has('IT')).toBe(true);
      expect(VALID_ROLES.has('PROCUREMENT')).toBe(false);
      expect(VALID_ROLES.has('AUDITOR')).toBe(false);
      expect(VALID_ROLES.has('ADMIN ')).toBe(false);
      expect(VALID_ROLES.has('admin')).toBe(false);
    });
  });

  describe('C-2: verifyToken rechaza tokens sin algorithms whitelist', () => {
    it('verifica un token válido generado por generateToken', () => {
      const token = generateToken({ userId: 'u-1', email: 'u@test.test', role: 'ADMIN' });
      const decoded = verifyToken(token);
      expect(decoded).toMatchObject({ userId: 'u-1', email: 'u@test.test', role: 'ADMIN' });
    });

    it('rechaza token firmado con "none" (algoritmo confusion)', () => {
      const noneToken = jwt.sign(
        { userId: 'u-1', email: 'u@test.test', role: 'ADMIN' },
        '',
        { algorithm: 'none' as jwt.Algorithm }
      );
      expect(verifyToken(noneToken)).toBeNull();
    });

    it('rechaza token sin firma', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(JSON.stringify({
        userId: 'u-1', email: 'u@test.test', role: 'ADMIN',
        iss: JWT_ISSUER, aud: JWT_AUDIENCE, exp: Math.floor(Date.now() / 1000) + 60,
      })).toString('base64url');
      const unsignedToken = `${header}.${payload}.`;
      expect(verifyToken(unsignedToken)).toBeNull();
    });

    it('rechaza token con issuer incorrecto', () => {
      const badIssuer = jwt.sign(
        { userId: 'u-1', email: 'u@test.test', role: 'ADMIN' },
        TEST_SECRET,
        { algorithm: 'HS256', expiresIn: '5m', issuer: 'evil', audience: JWT_AUDIENCE }
      );
      expect(verifyToken(badIssuer)).toBeNull();
    });

    it('rechaza token con audience incorrecto', () => {
      const badAud = jwt.sign(
        { userId: 'u-1', email: 'u@test.test', role: 'ADMIN' },
        TEST_SECRET,
        { algorithm: 'HS256', expiresIn: '5m', issuer: JWT_ISSUER, audience: 'evil-app' }
      );
      expect(verifyToken(badAud)).toBeNull();
    });
  });

  describe('verifyToken rechaza tokens con claims inválidos', () => {
    it('rechaza token sin userId', () => {
      const bad = jwt.sign(
        { email: 'u@test.test', role: 'ADMIN' },
        TEST_SECRET,
        { algorithm: 'HS256', expiresIn: '5m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );
      expect(verifyToken(bad)).toBeNull();
    });

    it('rechaza token con userId no-string', () => {
      const bad = jwt.sign(
        { userId: 123, email: 'u@test.test', role: 'ADMIN' },
        TEST_SECRET,
        { algorithm: 'HS256', expiresIn: '5m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );
      expect(verifyToken(bad)).toBeNull();
    });

    it('rechaza token con role fuera de la matriz', () => {
      const bad = jwt.sign(
        { userId: 'u-1', email: 'u@test.test', role: 'PROCUREMENT' },
        TEST_SECRET,
        { algorithm: 'HS256', expiresIn: '5m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );
      expect(verifyToken(bad)).toBeNull();
    });

    it('rechaza token con role inválido tipo number', () => {
      const bad = jwt.sign(
        { userId: 'u-1', email: 'u@test.test', role: 1 },
        TEST_SECRET,
        { algorithm: 'HS256', expiresIn: '5m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );
      expect(verifyToken(bad)).toBeNull();
    });

    it('rechaza token sin email', () => {
      const bad = jwt.sign(
        { userId: 'u-1', role: 'ADMIN' },
        TEST_SECRET,
        { algorithm: 'HS256', expiresIn: '5m', issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );
      expect(verifyToken(bad)).toBeNull();
    });

    it('rechaza token expirado', () => {
      const expired = jwt.sign(
        { userId: 'u-1', email: 'u@test.test', role: 'ADMIN' },
        TEST_SECRET,
        { algorithm: 'HS256', expiresIn: -1, issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
      );
      expect(verifyToken(expired)).toBeNull();
    });
  });

  describe('M-7: generateToken firma con iss/aud/jti', () => {
    it('token generado incluye jti único', () => {
      const token1 = generateToken({ userId: 'u-1', email: 'u@test.test', role: 'ADMIN' });
      const token2 = generateToken({ userId: 'u-1', email: 'u@test.test', role: 'ADMIN' });
      const decoded1 = jwt.decode(token1) as jwt.JwtPayload;
      const decoded2 = jwt.decode(token2) as jwt.JwtPayload;
      expect(decoded1.jti).toBeTypeOf('string');
      expect(decoded2.jti).toBeTypeOf('string');
      expect(decoded1.jti).not.toBe(decoded2.jti);
    });

    it('token generado incluye iss correcto', () => {
      const token = generateToken({ userId: 'u-1', email: 'u@test.test', role: 'ADMIN' });
      const decoded = jwt.decode(token, { complete: true });
      expect((decoded?.payload as jwt.JwtPayload).iss).toBe(JWT_ISSUER);
    });

    it('token generado incluye aud correcto', () => {
      const token = generateToken({ userId: 'u-1', email: 'u@test.test', role: 'ADMIN' });
      const decoded = jwt.decode(token, { complete: true });
      expect((decoded?.payload as jwt.JwtPayload).aud).toBe(JWT_AUDIENCE);
    });

    it('token generado usa solo HS256', () => {
      const token = generateToken({ userId: 'u-1', email: 'u@test.test', role: 'ADMIN' });
      const decoded = jwt.decode(token, { complete: true });
      expect(decoded?.header.alg).toBe('HS256');
    });

    it('generateToken rechaza userId vacío', () => {
      expect(() => generateToken({ userId: '', email: 'u@test.test', role: 'ADMIN' }))
        .toThrow(/userId/);
    });

    it('generateToken rechaza role inválido', () => {
      expect(() => generateToken({ userId: 'u-1', email: 'u@test.test', role: 'PROCUREMENT' as Role }))
        .toThrow(/role inválido/);
    });
  });

  describe('C-1: validateTokenClaims (Edge runtime)', () => {
    const now = Math.floor(Date.now() / 1000);
    const validClaims = {
      userId: 'u-1',
      email: 'u@test.test',
      role: 'ADMIN',
      iss: JWT_ISSUER,
      aud: JWT_AUDIENCE,
      iat: now,
      exp: now + 60,
      jti: 'test-jti',
    };

    it('acepta payload con todos los claims válidos', () => {
      const result = validateTokenClaims(validClaims);
      expect(result).not.toBeNull();
      expect(result?.userId).toBe('u-1');
      expect(result?.role).toBe('ADMIN');
    });

    it('rechaza payload null/undefined/no-objeto', () => {
      expect(validateTokenClaims(null)).toBeNull();
      expect(validateTokenClaims(undefined)).toBeNull();
      expect(validateTokenClaims('string')).toBeNull();
      expect(validateTokenClaims(42)).toBeNull();
      expect(validateTokenClaims([])).toBeNull();
    });

    it('rechaza payload sin userId', () => {
      const { userId: _userId, ...rest } = validClaims;
      void _userId;
      expect(validateTokenClaims(rest)).toBeNull();
    });

    it('rechaza payload con userId vacío', () => {
      expect(validateTokenClaims({ ...validClaims, userId: '' })).toBeNull();
    });

    it('rechaza payload sin email', () => {
      const { email: _email, ...rest } = validClaims;
      void _email;
      expect(validateTokenClaims(rest)).toBeNull();
    });

    it('rechaza payload con role inválido', () => {
      expect(validateTokenClaims({ ...validClaims, role: 'PROCUREMENT' })).toBeNull();
      expect(validateTokenClaims({ ...validClaims, role: '' })).toBeNull();
      expect(validateTokenClaims({ ...validClaims, role: 1 as unknown as Role })).toBeNull();
    });

    it('rechaza payload sin exp', () => {
      const { exp: _exp, ...rest } = validClaims;
      void _exp;
      expect(validateTokenClaims(rest)).toBeNull();
    });

    it('rechaza payload expirado (exp <= now)', () => {
      expect(validateTokenClaims({ ...validClaims, exp: now - 1 })).toBeNull();
      expect(validateTokenClaims({ ...validClaims, exp: now })).toBeNull();
    });

    it('rechaza payload sin iat', () => {
      const { iat: _iat, ...rest } = validClaims;
      void _iat;
      expect(validateTokenClaims(rest)).toBeNull();
    });

    it('rechaza payload con iat en el futuro (clock skew ataque)', () => {
      expect(validateTokenClaims({ ...validClaims, iat: now + 60 })).toBeNull();
    });

    it('rechaza payload con iat muy viejo (> 1h, anti-replay)', () => {
      expect(validateTokenClaims({ ...validClaims, iat: now - 3600 - 1 })).toBeNull();
    });

    it('rechaza payload con issuer incorrecto', () => {
      expect(validateTokenClaims({ ...validClaims, iss: 'evil' })).toBeNull();
    });

    it('rechaza payload con audience incorrecto', () => {
      expect(validateTokenClaims({ ...validClaims, aud: 'evil-app' })).toBeNull();
    });

    it('acepta payload con audience como array que incluye el correcto', () => {
      expect(validateTokenClaims({ ...validClaims, aud: [JWT_AUDIENCE, 'other'] })).not.toBeNull();
    });

    it('rechaza payload con audience array que no incluye el correcto', () => {
      expect(validateTokenClaims({ ...validClaims, aud: ['other-1', 'other-2'] })).toBeNull();
    });
  });
});
