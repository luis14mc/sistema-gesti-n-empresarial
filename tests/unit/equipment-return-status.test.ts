// Phase 10B — domain unit tests for the equipment return-condition mapper.
import { describe, expect, it } from 'vitest';
import { mapReturnConditionToStatus } from '@/lib/equipment-history';

describe('mapReturnConditionToStatus', () => {
  it('maps MANTENIMIENTO/IN_MAINTENANCE to IN_MAINTENANCE', () => {
    expect(mapReturnConditionToStatus('MANTENIMIENTO')).toBe('IN_MAINTENANCE');
    expect(mapReturnConditionToStatus('IN_MAINTENANCE')).toBe('IN_MAINTENANCE');
  });

  it('maps damage-related strings to DAMAGED', () => {
    expect(mapReturnConditionToStatus('DAÑADO')).toBe('DAMAGED');
    expect(mapReturnConditionToStatus('DANADO')).toBe('DAMAGED');
    expect(mapReturnConditionToStatus('DAMAGED')).toBe('DAMAGED');
  });

  it('maps retirement-related strings to RETIRED', () => {
    expect(mapReturnConditionToStatus('BAJA')).toBe('RETIRED');
    expect(mapReturnConditionToStatus('RETIRED')).toBe('RETIRED');
  });

  it('maps loss-related strings to LOST', () => {
    expect(mapReturnConditionToStatus('EXTRAVIADO')).toBe('LOST');
    expect(mapReturnConditionToStatus('PERDIDO')).toBe('LOST');
    expect(mapReturnConditionToStatus('LOST')).toBe('LOST');
  });

  it('defaults to AVAILABLE when no condition is given', () => {
    expect(mapReturnConditionToStatus()).toBe('AVAILABLE');
    expect(mapReturnConditionToStatus(undefined)).toBe('AVAILABLE');
    expect(mapReturnConditionToStatus('')).toBe('AVAILABLE');
  });

  it('allows an explicit equipmentStatusAfter when it is in the allowlist', () => {
    expect(mapReturnConditionToStatus('UNKNOWN', 'IN_MAINTENANCE')).toBe('IN_MAINTENANCE');
    expect(mapReturnConditionToStatus('UNKNOWN', 'RETIRED')).toBe('RETIRED');
  });

  it('falls back to the condition mapping when the explicit status is not allowlisted', () => {
    expect(mapReturnConditionToStatus('MANTENIMIENTO', 'NOT_AN_ALLOWED_STATUS')).toBe('IN_MAINTENANCE');
  });
});
