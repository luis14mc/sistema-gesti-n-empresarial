import { describe, expect, it } from 'vitest';
import type { OficioStatus } from '@/types';
import {
  OFICIO_STATUS_TRANSITIONS,
  OFICIO_TERMINAL_STATUSES,
  getNextOficioStatuses,
  isValidOficioStatusTransition,
} from '@/modules/oficios/domain/oficios-status-transitions';
import fixture from './__fixtures__/status-transitions.json';

const ALL_STATUSES = Object.keys(OFICIO_STATUS_TRANSITIONS) as OficioStatus[];

describe('oficios golden — transiciones de estado', () => {
  it('fixture coincide con OFICIO_STATUS_TRANSITIONS', () => {
    for (const status of ALL_STATUSES) {
      expect([...(fixture.transitions as Record<string, string[]>)[status] ?? []].sort()).toEqual(
        [...OFICIO_STATUS_TRANSITIONS[status]].sort(),
      );
    }
  });

  it('matriz completa: solo transiciones declaradas son válidas', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const allowed = (fixture.transitions as Record<string, string[]>)[from]?.includes(to);
        expect(isValidOficioStatusTransition(from, to)).toBe(Boolean(allowed));
      }
    }
  });

  it('no permite permanecer en el mismo estado', () => {
    if (fixture.selfTransitionForbidden) {
      for (const status of ALL_STATUSES) {
        expect(isValidOficioStatusTransition(status, status)).toBe(false);
      }
    }
  });

  it('estados terminales no tienen salidas', () => {
    for (const terminal of fixture.terminalStatuses as OficioStatus[]) {
      expect(OFICIO_TERMINAL_STATUSES).toContain(terminal);
      expect(getNextOficioStatuses(terminal)).toEqual([]);
    }
  });
});
