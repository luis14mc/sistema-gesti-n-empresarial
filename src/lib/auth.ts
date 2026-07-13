import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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
  return jwt.sign(payload, getSecret(), { expiresIn: '1h' });
};

export const verifyToken = (token: string): TokenPayload | null => {
  try {
    return jwt.verify(token, getSecret()) as TokenPayload;
  } catch {
    return null;
  }
};
