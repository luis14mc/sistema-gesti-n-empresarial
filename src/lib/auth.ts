import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_EXPIRES_IN,
  JWT_ISSUER,
  VALID_ROLES,
  type Role,
} from './jwt-config';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

const SECRET_MIN_LENGTH = 32;

/** Lee JWT_SECRET desde env con validación fail-fast. */
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('[Auth] JWT_SECRET no está definida — la aplicación no puede funcionar sin ella.');
  }
  if (secret.length < SECRET_MIN_LENGTH) {
    throw new Error(`[Auth] JWT_SECRET debe tener al menos ${SECRET_MIN_LENGTH} caracteres.`);
  }
  return secret;
}

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateToken = (payload: TokenPayload): string => {
  if (!payload.userId || typeof payload.userId !== 'string') {
    throw new Error('[Auth] generateToken: userId requerido');
  }
  if (!payload.role || !VALID_ROLES.has(payload.role)) {
    throw new Error(`[Auth] generateToken: role inválido "${payload.role}"`);
  }

  const jti = crypto.randomUUID();
  return jwt.sign(
    {
      ...payload,
      jti,
    },
    getSecret(),
    {
      algorithm: JWT_ALGORITHM,
      expiresIn: JWT_EXPIRES_IN,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    const decoded = jwt.verify(token, getSecret(), {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as jwt.JwtPayload;

    if (!decoded.userId || typeof decoded.userId !== 'string') return null;
    if (!decoded.role || !VALID_ROLES.has(decoded.role as Role)) return null;
    if (!decoded.email || typeof decoded.email !== 'string') return null;

    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };
  } catch {
    return null;
  }
};
