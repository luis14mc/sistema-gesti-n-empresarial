import { describe, expect, it } from 'vitest';
import { assertManualEquipmentStatusUpdate } from '@/modules/equipment/domain/equipment-status-manual';
import { DomainConflictError, InvalidDomainDataError } from '@/platform/domain/errors';
import { EquipmentFlowStatusError } from '@/modules/equipment/domain/equipment-status-manual';

describe('assertManualEquipmentStatusUpdate', () => {
  it('rejects ASSIGNED and AVAILABLE with 400 message', () => {
    expect(() =>
      assertManualEquipmentStatusUpdate({ requested: 'ASSIGNED', current: 'AVAILABLE', hasActiveAssignment: false }),
    ).toThrow(EquipmentFlowStatusError);
    expect(() =>
      assertManualEquipmentStatusUpdate({ requested: 'AVAILABLE', current: 'DAMAGED', hasActiveAssignment: false }),
    ).toThrow(EquipmentFlowStatusError);
  });

  it('allows DAMAGED/LOST only without active assignment', () => {
    expect(
      assertManualEquipmentStatusUpdate({ requested: 'DAMAGED', current: 'AVAILABLE', hasActiveAssignment: false }),
    ).toBe('DAMAGED');
    expect(() =>
      assertManualEquipmentStatusUpdate({ requested: 'LOST', current: 'AVAILABLE', hasActiveAssignment: true }),
    ).toThrow(DomainConflictError);
  });

  it('blocks workflow-only statuses such as IN_MAINTENANCE', () => {
    expect(() =>
      assertManualEquipmentStatusUpdate({ requested: 'IN_MAINTENANCE', current: 'AVAILABLE', hasActiveAssignment: false }),
    ).toThrow(InvalidDomainDataError);
  });
});
