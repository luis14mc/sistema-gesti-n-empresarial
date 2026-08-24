import { describe, expect, it } from 'vitest';
import {
  can,
  canWithOverrides,
  organizationRole,
} from '../src/platform/security/authorization/permissions';

describe('CNI organization roles', () => {
  it('gives administration operational access without user administration', () => {
    const role = organizationRole('ADMINISTRACION');

    expect(can(role, 'equipment.maintain')).toBe(true);
    expect(can(role, 'purchase-orders.create')).toBe(true);
    expect(can(role, 'users.create')).toBe(false);
    expect(can(role, 'offices.create')).toBe(false);
  });

  it('gives secretaria Oficios lifecycle access without hard delete', () => {
    const role = organizationRole('SECRETARIA');

    expect(can(role, 'oficios.read')).toBe(true);
    expect(can(role, 'oficios.create')).toBe(true);
    expect(can(role, 'oficios.deactivate')).toBe(true);
    expect(can(role, 'oficios.attachments')).toBe(true);
    // Hard delete is intentionally absent from the canonical catalog.
    // @ts-expect-error hard delete is not a supported Oficios permission
    expect(can(role, 'oficios.delete')).toBe(false);
  });

  it('does not grant Oficios to director by default', () => {
    const role = organizationRole('DIRECTOR');

    expect(can(role, 'oficios.read')).toBe(false);
    expect(canWithOverrides(role, 'oficios.read', [
      { permission: 'oficios.read', effect: 'ALLOW' },
    ])).toBe(true);
  });

  it('applies DENY before ALLOW', () => {
    const role = organizationRole('DIRECTOR');

    expect(canWithOverrides(role, 'oficios.read', [
      { permission: 'oficios.read', effect: 'ALLOW' },
      { permission: 'oficios.read', effect: 'DENY' },
    ])).toBe(false);
  });
});
