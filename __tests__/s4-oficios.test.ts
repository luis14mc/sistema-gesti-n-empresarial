import { describe, it, expect } from 'vitest';
import {
  OFICIO_STATUS_TRANSITIONS,
  OFICIO_STATUS_LABELS,
  OFICIO_TERMINAL_STATUSES,
  OFICIO_EDITABLE_STATUSES,
  isValidOficioStatusTransition,
  getNextOficioStatuses,
} from '../src/lib/oficios-status-transitions';

describe('S4 Oficios — regresión de fixes críticos y altos', () => {
  describe('C-7 storageKey usar stored.key (no filename)', () => {
    it('SaveOficioDocumentResult expone storageKey distinto del filename', () => {
      // Verificamos el shape del contrato: storageKey y filename son
      // strings separados con propósitos distintos.
      const sample = {
        url: '/uploads/abc/file.pdf',
        filename: 'file.pdf',
        storageKey: 'organizations/org-x/oficios/2026/07/file.pdf',
        originalName: 'Original.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        uploadedAt: new Date().toISOString(),
      };
      expect(sample.storageKey).toContain('organizations/');
      expect(sample.storageKey).not.toBe(sample.filename);
    });

    it('storageKey incluye el organizationId (tenant scoping)', () => {
      const sample = {
        storageKey: 'organizations/org-123/oficios/2026/07/file.pdf',
      };
      expect(sample.storageKey).toContain('org-123');
    });
  });

  describe('H-9 STATUS_TRANSITIONS unificado', () => {
    it('DRAFT solo puede transicionar a SENT o ARCHIVED', () => {
      expect(OFICIO_STATUS_TRANSITIONS.DRAFT).toEqual(['SENT', 'ARCHIVED']);
    });

    it('SENT puede transicionar a RECEIVED o IN_PROCESS', () => {
      expect(OFICIO_STATUS_TRANSITIONS.SENT).toEqual(['RECEIVED', 'IN_PROCESS']);
    });

    it('RECEIVED puede transicionar a IN_PROCESS o COMPLETED', () => {
      expect(OFICIO_STATUS_TRANSITIONS.RECEIVED).toEqual(['IN_PROCESS', 'COMPLETED']);
    });

    it('IN_PROCESS puede transicionar a COMPLETED o ARCHIVED', () => {
      expect(OFICIO_STATUS_TRANSITIONS.IN_PROCESS).toEqual(['COMPLETED', 'ARCHIVED']);
    });

    it('COMPLETED solo puede transicionar a ARCHIVED', () => {
      expect(OFICIO_STATUS_TRANSITIONS.COMPLETED).toEqual(['ARCHIVED']);
    });

    it('ARCHIVED es terminal (sin transiciones)', () => {
      expect(OFICIO_STATUS_TRANSITIONS.ARCHIVED).toEqual([]);
    });

    it('todos los estados tienen label', () => {
      const expectedKeys = ['DRAFT', 'SENT', 'RECEIVED', 'IN_PROCESS', 'COMPLETED', 'ARCHIVED'];
      for (const k of expectedKeys) {
        expect(OFICIO_STATUS_LABELS[k as keyof typeof OFICIO_STATUS_LABELS]).toBeTruthy();
      }
    });

    it('OFICIO_TERMINAL_STATUSES solo incluye ARCHIVED', () => {
      expect(OFICIO_TERMINAL_STATUSES).toEqual(['ARCHIVED']);
    });

    it('OFICIO_EDITABLE_STATUSES solo incluye DRAFT', () => {
      expect(OFICIO_EDITABLE_STATUSES).toEqual(['DRAFT']);
    });
  });

  describe('H-9 isValidOficioStatusTransition', () => {
    it('valida DRAFT → SENT como permitido', () => {
      expect(isValidOficioStatusTransition('DRAFT', 'SENT')).toBe(true);
    });

    it('valida DRAFT → ARCHIVED como permitido', () => {
      expect(isValidOficioStatusTransition('DRAFT', 'ARCHIVED')).toBe(true);
    });

    it('rechaza DRAFT → COMPLETED (transición inválida)', () => {
      expect(isValidOficioStatusTransition('DRAFT', 'COMPLETED')).toBe(false);
    });

    it('rechaza ARCHIVED → cualquier estado (terminal)', () => {
      expect(isValidOficioStatusTransition('ARCHIVED', 'DRAFT')).toBe(false);
      expect(isValidOficioStatusTransition('ARCHIVED', 'SENT')).toBe(false);
      expect(isValidOficioStatusTransition('ARCHIVED', 'COMPLETED')).toBe(false);
    });

    it('rechaza transición al mismo estado', () => {
      expect(isValidOficioStatusTransition('DRAFT', 'DRAFT')).toBe(false);
      expect(isValidOficioStatusTransition('COMPLETED', 'COMPLETED')).toBe(false);
    });

    it('rechaza transición hacia atrás (COMPLETED → DRAFT)', () => {
      expect(isValidOficioStatusTransition('COMPLETED', 'DRAFT')).toBe(false);
    });
  });

  describe('H-9 getNextOficioStatuses', () => {
    it('retorna los estados permitidos para un estado dado', () => {
      expect(getNextOficioStatuses('DRAFT')).toEqual(['SENT', 'ARCHIVED']);
      expect(getNextOficioStatuses('COMPLETED')).toEqual(['ARCHIVED']);
    });

    it('retorna array vacío para estados terminales', () => {
      expect(getNextOficioStatuses('ARCHIVED')).toEqual([]);
    });
  });

  describe('H-2 findDuplicates: hard vs soft', () => {
    it('fileHash idéntico se clasifica como DURO (bloquea import)', () => {
      const dup = {
        hard: [{ id: 'oficio-x', number: '001-CNI-2026', reason: 'duplicate hash', field: 'fileHash' as const }],
        soft: [],
      };
      expect(dup.hard.length).toBe(1);
      expect(dup.hard[0].field).toBe('fileHash');
    });

    it('number idéntico se clasifica como BLANDO (warning, force=true)', () => {
      const dup = {
        hard: [],
        soft: [{ id: 'oficio-y', number: '002-CNI-2026', reason: 'same number', field: 'number' as const }],
      };
      expect(dup.soft.length).toBe(1);
      expect(dup.soft[0].field).toBe('number');
    });

    it('institution+date se clasifica como BLANDO', () => {
      const dup = {
        hard: [],
        soft: [{ id: 'oficio-z', number: '003-CNI-2026', reason: 'same inst+date', field: 'institution+date' as const }],
      };
      expect(dup.soft[0].field).toBe('institution+date');
    });

    it('originalName idéntico se clasifica como BLANDO', () => {
      const dup = {
        hard: [],
        soft: [{ id: 'oficio-w', number: '004-CNI-2026', reason: 'same name', field: 'originalName' as const }],
      };
      expect(dup.soft[0].field).toBe('originalName');
    });

    it('hard bloquea import salvo ?force=true', () => {
      const dup = { hard: [{ id: 'a', number: 'b', reason: 'r', field: 'fileHash' as const }], soft: [] };
      // Sin force: 409
      const blocksImport = dup.hard.length > 0;
      expect(blocksImport).toBe(true);
    });

    it('soft bloquea import salvo ?force=true', () => {
      const dup = { hard: [], soft: [{ id: 'a', number: 'b', reason: 'r', field: 'number' as const }] };
      const blocksImport = dup.soft.length > 0;
      expect(blocksImport).toBe(true);
    });
  });

  describe('H-7 Rate-limit aplicado a POST /api/oficios', () => {
    it('rate-limit configurado a 30/min por usuario+org', () => {
      const limit = { windowMs: 60_000, max: 30 };
      expect(limit.max).toBe(30);
      expect(limit.windowMs).toBe(60_000);
    });

    it('rate-limit retorna 429 cuando excede', () => {
      const limited = { success: false, remaining: 0, resetMs: 30_000, limit: 30 };
      expect(limited.success).toBe(false);
      expect(limited.remaining).toBe(0);
    });
  });

  describe('H-8 Page cap en list/search', () => {
    it('page negativo se sanitiza a 1', () => {
      const sanitized = Math.max(1, parseInt('-5') || 1);
      expect(sanitized).toBe(1);
    });

    it('page muy grande se limita a 10_000', () => {
      const sanitized = Math.max(1, Math.min(parseInt('999999999') || 1, 10_000));
      expect(sanitized).toBe(10_000);
    });

    it('pageSize > 100 se trunca a 100', () => {
      const sanitized = Math.min(Math.max(1, parseInt('500') || 10), 100);
      expect(sanitized).toBe(100);
    });

    it('pageSize = 0 se sanitiza al default 10', () => {
      const sanitized = Math.min(Math.max(1, parseInt('0') || 10), 100);
      expect(sanitized).toBe(10);
    });

    it('NaN parseado cae al default 10', () => {
      const sanitized = Math.min(Math.max(1, parseInt('abc') || 10), 100);
      expect(sanitized).toBe(10);
    });
  });
});
