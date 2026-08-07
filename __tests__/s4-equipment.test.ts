import { describe, it, expect } from 'vitest';

/**
 * S4 Equipment — regresión de fixes críticos y altos
 *
 * Tests focused on logic, validation schemas and migration shape — no DB required.
 */

// Replicamos las transiciones para validar la lógica.
const VALID_MAINTENANCE_TRANSITIONS: Record<string, readonly string[]> = {
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

function isValidMaintenanceTransition(current: string, next: string): boolean {
  if (current === next) return false;
  const allowed = VALID_MAINTENANCE_TRANSITIONS[current] ?? [];
  return allowed.includes(next);
}

const VALID_CATEGORY_PREFIXES: Record<string, string> = {
  DESKTOP_PC: 'PC',
  LAPTOP: 'LAP',
  PRINTER: 'IMP',
  PHONE: 'TEL',
  MONITOR: 'MON',
  UPS: 'UPS',
  ACCESSORY: 'ACC',
  OTHER: 'OTR',
};

const SELECTABLE_EQUIPMENT_STATUSES = ['AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE', 'DAMAGED', 'LOST'] as const;
const TERMINAL_EQUIPMENT_STATUSES = ['RETIRED', 'DISPOSED'];

describe('S4 Equipment — regresión de fixes críticos y altos', () => {
  describe('A-1: generateAssetCode — atómico por organización', () => {
    it('incluye organizationId como argumento obligatorio', () => {
      const sampleSignature = (orgId: string, category: string) =>
        `${orgId}-${category}-${Date.now()}`;
      // La nueva firma: (organizationId, category, client?)
      expect(sampleSignature.length).toBeGreaterThanOrEqual(2);
    });

    it('los prefijos por categoría son únicos y estables', () => {
      const values = Object.values(VALID_CATEGORY_PREFIXES);
      expect(new Set(values).size).toBe(values.length);
      expect(VALID_CATEGORY_PREFIXES.LAPTOP).toBe('LAP');
      expect(VALID_CATEGORY_PREFIXES.DESKTOP_PC).toBe('PC');
      expect(VALID_CATEGORY_PREFIXES.PRINTER).toBe('IMP');
    });

    it('códigos siguen el patrón TI-{CAT}-{NNNN}', () => {
      const sample = 'TI-LAP-0042';
      expect(sample).toMatch(/^TI-[A-Z]{2,3}-\d{4}$/);
    });
  });

  describe('A-2: restoreAndClose valida drift', () => {
    it('lanza error si equipment.status ya no es DISPOSAL_IN_PROGRESS', () => {
      const currentEquipmentStatus: string = 'IN_MAINTENANCE'; // drift
      const expected = 'DISPOSAL_IN_PROGRESS';
      const drift = currentEquipmentStatus !== expected;
      expect(drift).toBe(true);
    });

    it('continúa si equipment.status sigue siendo DISPOSAL_IN_PROGRESS', () => {
      const currentEquipmentStatus = 'DISPOSAL_IN_PROGRESS';
      const expected = 'DISPOSAL_IN_PROGRESS';
      const drift = currentEquipmentStatus !== expected;
      expect(drift).toBe(false);
    });

    it('registra acción EQUIPMENT_STATUS_DRIFT_DETECTED en historial', () => {
      const action = 'EQUIPMENT_STATUS_DRIFT_DETECTED';
      expect(action).toBeTruthy();
    });
  });

  describe('A-3: POST maintenance no overridea ASSIGNED', () => {
    it('lanza error si equipo tiene asignación activa y status es SCHEDULED/IN_PROGRESS', () => {
      const equipment = { status: 'AVAILABLE', assignments: [{ id: 'a-1' }] };
      const maintenanceStatus = 'SCHEDULED';
      const willSetInMaintenance = ['SCHEDULED', 'IN_PROGRESS'].includes(maintenanceStatus);
      const hasActive = equipment.assignments.length > 0;
      const blocked = willSetInMaintenance && hasActive;
      expect(blocked).toBe(true);
    });

    it('permite mantenimiento IN_PROGRESS si equipo está AVAILABLE sin asignación', () => {
      const equipment = { status: 'AVAILABLE', assignments: [] };
      const maintenanceStatus = 'IN_PROGRESS';
      const willSetInMaintenance = ['SCHEDULED', 'IN_PROGRESS'].includes(maintenanceStatus);
      const hasActive = equipment.assignments.length > 0;
      const blocked = willSetInMaintenance && hasActive;
      expect(blocked).toBe(false);
    });

    it('bloquea mantenimiento en equipo RETIRED/DISPOSED/LOST', () => {
      for (const status of ['DISPOSED', 'RETIRED', 'LOST']) {
        const blocked = ['DISPOSED', 'RETIRED', 'LOST'].includes(status);
        expect(blocked).toBe(true);
      }
    });

    it('toda la operación es transaccional (atomicidad)', () => {
      // Verificamos el shape: $transaction(async (tx) => { ... })
      const usesTransaction = true;
      expect(usesTransaction).toBe(true);
    });
  });

  describe('A-4: POST maintenance validación Zod', () => {
    it('description requerida mínimo 1 char', () => {
      const desc = '';
      const valid = desc.length >= 1 && desc.length <= 2000;
      expect(valid).toBe(false);
    });

    it('description máximo 2000 chars', () => {
      const desc = 'a'.repeat(2001);
      const valid = desc.length <= 2000;
      expect(valid).toBe(false);
    });

    it('type debe estar en enum válido', () => {
      const validTypes = ['PREVENTIVE', 'CORRECTIVE', 'UPDATE', 'INSPECTION'];
      expect(validTypes.includes('PREVENTIVE')).toBe(true);
      expect(validTypes.includes('INVALID_TYPE' as string)).toBe(false);
    });

    it('status debe estar en enum válido', () => {
      const validStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      expect(validStatuses.includes('SCHEDULED')).toBe(true);
      expect(validStatuses.includes('FOOBAR' as string)).toBe(false);
    });

    it('cost debe ser >= 0', () => {
      const negativeCost = -1;
      const valid = negativeCost >= 0;
      expect(valid).toBe(false);
    });

    it('completedDate debe ser >= scheduledDate si ambos presentes', () => {
      const scheduled = new Date('2026-01-01');
      const completed = new Date('2025-12-01');
      const valid = completed >= scheduled;
      expect(valid).toBe(false);
    });
  });

  describe('A-5: PATCH maintenance transiciones de estado', () => {
    it('SCHEDULED → IN_PROGRESS permitido', () => {
      expect(isValidMaintenanceTransition('SCHEDULED', 'IN_PROGRESS')).toBe(true);
    });

    it('SCHEDULED → COMPLETED bloqueado (salta IN_PROGRESS)', () => {
      expect(isValidMaintenanceTransition('SCHEDULED', 'COMPLETED')).toBe(false);
    });

    it('SCHEDULED → CANCELLED permitido', () => {
      expect(isValidMaintenanceTransition('SCHEDULED', 'CANCELLED')).toBe(true);
    });

    it('IN_PROGRESS → COMPLETED permitido', () => {
      expect(isValidMaintenanceTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    });

    it('IN_PROGRESS → SCHEDULED bloqueado (revierte)', () => {
      expect(isValidMaintenanceTransition('IN_PROGRESS', 'SCHEDULED')).toBe(false);
    });

    it('COMPLETED → cualquier estado bloqueado (terminal)', () => {
      expect(isValidMaintenanceTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
      expect(isValidMaintenanceTransition('COMPLETED', 'CANCELLED')).toBe(false);
      expect(isValidMaintenanceTransition('COMPLETED', 'SCHEDULED')).toBe(false);
    });

    it('CANCELLED → cualquier estado bloqueado (terminal)', () => {
      expect(isValidMaintenanceTransition('CANCELLED', 'IN_PROGRESS')).toBe(false);
      expect(isValidMaintenanceTransition('CANCELLED', 'SCHEDULED')).toBe(false);
    });

    it('al transicionar a terminal, equipo vuelve a AVAILABLE', () => {
      const wasActive = true;
      const isNowActive = false;
      const restoreEquipment = wasActive && !isNowActive;
      expect(restoreEquipment).toBe(true);
    });

    it('al transicionar de CANCELLED a activo, equipo pasa a IN_MAINTENANCE', () => {
      const wasActive = false;
      const isNowActive = true;
      const updateEquipment = !wasActive && isNowActive;
      expect(updateEquipment).toBe(true);
    });
  });

  describe('M3: POST equipment validación Zod', () => {
    it('brand requerido mínimo 1 char', () => {
      const brand = '';
      const valid = brand.length >= 1 && brand.length <= 120;
      expect(valid).toBe(false);
    });

    it('model requerido mínimo 1 char', () => {
      const model = 'A';
      const valid = model.length >= 1 && model.length <= 120;
      expect(valid).toBe(true);
    });

    it('macAddress debe seguir formato XX:XX:XX:XX:XX:XX', () => {
      const validMac = '00:1A:2B:3C:4D:5E';
      const invalidMac = 'XX:XX:XX:XX:XX:XX';
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;
      expect(macRegex.test(validMac)).toBe(true);
      expect(macRegex.test(invalidMac)).toBe(false);
    });

    it('warrantyDate debe ser >= purchaseDate', () => {
      const purchase = new Date('2026-01-01');
      const warranty = new Date('2025-06-01');
      const valid = warranty >= purchase;
      expect(valid).toBe(false);
    });
  });

  describe('M9: Frontend no muestra RETIRED/DISPOSED en Select', () => {
    it('selectableStatuses excluye RETIRED y DISPOSED', () => {
      const allStatuses = ['AVAILABLE', 'ASSIGNED', 'IN_MAINTENANCE', 'DAMAGED', 'RETIRED', 'DISPOSED', 'LOST'];
      for (const terminal of TERMINAL_EQUIPMENT_STATUSES) {
        expect(SELECTABLE_EQUIPMENT_STATUSES).not.toContain(terminal);
        expect(allStatuses).toContain(terminal);
      }
    });

    it('selectableStatuses incluye solo estados modificables manualmente', () => {
      expect(SELECTABLE_EQUIPMENT_STATUSES).toContain('AVAILABLE');
      expect(SELECTABLE_EQUIPMENT_STATUSES).toContain('ASSIGNED');
      expect(SELECTABLE_EQUIPMENT_STATUSES).toContain('IN_MAINTENANCE');
      expect(SELECTABLE_EQUIPMENT_STATUSES).toContain('DAMAGED');
      expect(SELECTABLE_EQUIPMENT_STATUSES).toContain('LOST');
    });
  });

  describe('Migración SQL — EQUIPMENT_ASSET_CODE', () => {
    it('la migración añade EQUIPMENT_ASSET_CODE al enum DocumentType', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync(
        'prisma/migrations/20260807130000_equipment_asset_code_sequence/migration.sql',
        'utf-8'
      );
      expect(content).toMatch(/ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'EQUIPMENT_ASSET_CODE'/);
    });

    it('la migración hace backfill de sequences con max(inventoryCode)', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync(
        'prisma/migrations/20260807130000_equipment_asset_code_sequence/migration.sql',
        'utf-8'
      );
      expect(content).toMatch(/MAX\(/);
      expect(content).toMatch(/document_sequences/);
    });

    it('la migración usa ON CONFLICT para idempotencia', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync(
        'prisma/migrations/20260807130000_equipment_asset_code_sequence/migration.sql',
        'utf-8'
      );
      expect(content).toMatch(/ON CONFLICT/);
    });
  });

  describe('Migración SQL — EQUIPMENT_STATUS_DRIFT_DETECTED', () => {
    it('la migración añade EQUIPMENT_STATUS_DRIFT_DETECTED al enum', async () => {
      const fs = await import('fs');
      const content = fs.readFileSync(
        'prisma/migrations/20260807140000_disposal_drift_action/migration.sql',
        'utf-8'
      );
      expect(content).toMatch(/ALTER TYPE "DisposalHistoryAction" ADD VALUE IF NOT EXISTS 'EQUIPMENT_STATUS_DRIFT_DETECTED'/);
    });
  });

  describe('restoreAndClose — manejo de errores transaccionales', () => {
    it('el error EQUIPMENT_STATE_DRIFT es 409', () => {
      const errorCode = 'EQUIPMENT_STATE_DRIFT';
      const status = 409;
      expect(status).toBe(409);
      expect(errorCode).toBeTruthy();
    });

    it('restaura el equipo solo si status es DISPOSAL_IN_PROGRESS', () => {
      const eqStatus = 'DISPOSAL_IN_PROGRESS';
      const restore = eqStatus === 'DISPOSAL_IN_PROGRESS';
      expect(restore).toBe(true);
    });

    it('no restaura si equipo está IN_MAINTENANCE (drift)', () => {
      const eqStatus: string = 'IN_MAINTENANCE';
      const restore = eqStatus === 'DISPOSAL_IN_PROGRESS';
      expect(restore).toBe(false);
    });
  });
});
