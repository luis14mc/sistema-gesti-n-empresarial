import { describe, expect, it } from 'vitest';
import {
  assertManualEquipmentStatusUpdate,
  EquipmentFlowStatusError,
} from '@/modules/equipment/domain/equipment-status-manual';
import { DomainConflictError, InvalidDomainDataError } from '@/platform/domain/errors';

describe('assertManualEquipmentStatusUpdate', () => {
  it('rejects ASSIGNED with 400', () => {
    expect(() =>
      assertManualEquipmentStatusUpdate({
        requested: 'ASSIGNED',
        current: 'AVAILABLE',
        hasActiveAssignment: false,
        hasOpenMaintenance: false,
      }),
    ).toThrow(EquipmentFlowStatusError);
  });

  it('allows DAMAGED→AVAILABLE and LOST→AVAILABLE without asignación ni mantenimiento abierto', () => {
    expect(
      assertManualEquipmentStatusUpdate({
        requested: 'AVAILABLE',
        current: 'DAMAGED',
        hasActiveAssignment: false,
        hasOpenMaintenance: false,
      }),
    ).toBe('AVAILABLE');
    expect(
      assertManualEquipmentStatusUpdate({
        requested: 'AVAILABLE',
        current: 'LOST',
        hasActiveAssignment: false,
        hasOpenMaintenance: false,
      }),
    ).toBe('AVAILABLE');
  });

  it('blocks AVAILABLE manual desde IN_MAINTENANCE y otros estados operativos', () => {
    expect(() =>
      assertManualEquipmentStatusUpdate({
        requested: 'AVAILABLE',
        current: 'IN_MAINTENANCE',
        hasActiveAssignment: false,
        hasOpenMaintenance: false,
      }),
    ).toThrow(EquipmentFlowStatusError);
    expect(() =>
      assertManualEquipmentStatusUpdate({
        requested: 'AVAILABLE',
        current: 'AVAILABLE',
        hasActiveAssignment: false,
        hasOpenMaintenance: false,
      }),
    ).not.toThrow();
  });

  it('409 si hay mantenimiento abierto al marcar disponible desde dañado', () => {
    expect(() =>
      assertManualEquipmentStatusUpdate({
        requested: 'AVAILABLE',
        current: 'DAMAGED',
        hasActiveAssignment: false,
        hasOpenMaintenance: true,
      }),
    ).toThrow(DomainConflictError);
    expect(() =>
      assertManualEquipmentStatusUpdate({
        requested: 'AVAILABLE',
        current: 'DAMAGED',
        hasActiveAssignment: false,
        hasOpenMaintenance: true,
      }),
    ).toThrow('Complete o cancele el mantenimiento abierto.');
  });

  it('allows DAMAGED/LOST only without active assignment', () => {
    expect(
      assertManualEquipmentStatusUpdate({
        requested: 'DAMAGED',
        current: 'AVAILABLE',
        hasActiveAssignment: false,
        hasOpenMaintenance: false,
      }),
    ).toBe('DAMAGED');
    expect(() =>
      assertManualEquipmentStatusUpdate({
        requested: 'LOST',
        current: 'AVAILABLE',
        hasActiveAssignment: true,
        hasOpenMaintenance: false,
      }),
    ).toThrow(DomainConflictError);
  });

  it('blocks workflow-only statuses such as IN_MAINTENANCE', () => {
    expect(() =>
      assertManualEquipmentStatusUpdate({
        requested: 'IN_MAINTENANCE',
        current: 'AVAILABLE',
        hasActiveAssignment: false,
        hasOpenMaintenance: false,
      }),
    ).toThrow(InvalidDomainDataError);
  });
});
