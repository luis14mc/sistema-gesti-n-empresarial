import { describe, it, expect } from 'vitest';
import { hashPassword, comparePassword } from '../src/lib/auth';

describe('Auth Utilities', () => {
  it('should hash a password and verify it correctly', async () => {
    const plainPassword = 'mySecurePassword123';
    
    // Hash the password
    const hashed = await hashPassword(plainPassword);
    
    // It should not be equal to plain text
    expect(hashed).not.toBe(plainPassword);
    
    // It should verify successfully with the correct password
    const isMatch = await comparePassword(plainPassword, hashed);
    expect(isMatch).toBe(true);
    
    // It should fail verification with wrong password
    const isFalseMatch = await comparePassword('wrongpassword', hashed);
    expect(isFalseMatch).toBe(false);
  });
});
