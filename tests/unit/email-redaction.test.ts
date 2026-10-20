import { describe, expect, it } from 'vitest';
import { maskEmailAddress, redactEmailsInJson, redactEmailsInText } from '@/platform/security/audit/email-redaction';

describe('email redaction for audit logs', () => {
  it('masks an email like j***@cni.hn', () => {
    expect(maskEmailAddress('juan@cni.hn')).toBe('j***@cni.hn');
  });

  it('redacts emails embedded in description text', () => {
    expect(redactEmailsInText('Usuario juan@cni.hn actualizó el registro.')).toBe(
      'Usuario j***@cni.hn actualizó el registro.',
    );
  });

  it('redacts emails inside JSON payloads', () => {
    expect(
      redactEmailsInJson({ email: 'admin@cni.hn', nested: { note: 'contact ana@cni.hn' } }),
    ).toEqual({ email: 'a***@cni.hn', nested: { note: 'contact a***@cni.hn' } });
  });
});
