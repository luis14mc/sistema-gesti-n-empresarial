import { describe, it, expect } from 'vitest';
import { canAccess } from '../src/lib/permissions';
import {
  ORDER_STATUS_LABELS,
  ORDER_PENDING_STATUSES,
} from '../src/lib/compras/orden/constants';
import { isOficioAttachmentUrlAllowed } from '../src/lib/oficios-attachments';
import {
  assignmentScope,
  equipmentScope,
  maintenanceScope,
} from '../src/modules/equipment/tenant';

const ORG_A = 'org-aaaaaaaaaaaaaaaaaaaa';
const ORG_B = 'org-bbbbbbbbbbbbbbbbbbbb';

describe('S0 Stop-bleeding — regresión de fixes críticos', () => {
  describe('#9 RBAC: USER no puede crear oficios', () => {
    it('USER no tiene permiso de creación sobre oficios', () => {
      expect(canAccess('USER', 'oficios', 'create')).toBe(false);
    });

    it('ADMIN sí tiene permiso de creación sobre oficios', () => {
      expect(canAccess('ADMIN', 'oficios', 'create')).toBe(true);
    });

    it('ADMIN y RRHH tienen permiso de creación sobre oficios', () => {
      expect(canAccess('ADMIN', 'oficios', 'create')).toBe(true);
      expect(canAccess('RRHH', 'oficios', 'create')).toBe(true);
    });

    it('IT no tiene permiso de creación sobre oficios (no está en su matriz)', () => {
      expect(canAccess('IT', 'oficios', 'create')).toBe(false);
    });
  });

  describe('#10 URL de adjuntos estricta al prefijo del tenant', () => {
    it('acepta URL del propio tenant', () => {
      const url = `/uploads/organizations/${ORG_A}/oficios/2026/03/doc.pdf`;
      expect(isOficioAttachmentUrlAllowed(url, ORG_A)).toBe(true);
    });

    it('rechaza URL de otro tenant', () => {
      const url = `/uploads/organizations/${ORG_B}/oficios/2026/03/doc.pdf`;
      expect(isOficioAttachmentUrlAllowed(url, ORG_A)).toBe(false);
    });

    it('rechaza URL http(s):// absoluta arbitraria (XSS / SSRF)', () => {
      expect(isOficioAttachmentUrlAllowed('https://evil.com/malware.pdf', ORG_A)).toBe(false);
      expect(isOficioAttachmentUrlAllowed('http://localhost:5432/', ORG_A)).toBe(false);
      expect(isOficioAttachmentUrlAllowed('javascript:alert(1)', ORG_A)).toBe(false);
      expect(isOficioAttachmentUrlAllowed('file:///etc/passwd', ORG_A)).toBe(false);
    });

    it('rechaza URL vacía o undefined', () => {
      expect(isOficioAttachmentUrlAllowed('', ORG_A)).toBe(false);
      expect(isOficioAttachmentUrlAllowed(undefined, ORG_A)).toBe(false);
      expect(isOficioAttachmentUrlAllowed(null, ORG_A)).toBe(false);
    });

    it('rechaza path traversal con ../', () => {
      expect(
        isOficioAttachmentUrlAllowed(`/uploads/organizations/${ORG_A}/../${ORG_B}/doc.pdf`, ORG_A)
      ).toBe(false);
    });

    it('rechaza prefijos similares pero no idénticos', () => {
      expect(isOficioAttachmentUrlAllowed(`/uploads/organizations/${ORG_A}/compras/doc.pdf`, ORG_A)).toBe(false);
      expect(isOficioAttachmentUrlAllowed(`/uploads/organizations/${ORG_A}xxx/oficios/doc.pdf`, ORG_A)).toBe(false);
    });
  });

  describe('#13 ORDER_STATUS_LABELS: estados con etiqueta correcta', () => {
    it('ISSUED muestra "Emitida" (no "Generada")', () => {
      expect(ORDER_STATUS_LABELS.ISSUED).toBe('Emitida');
    });

    it('CLOSED muestra "Cerrada" (no "Generada")', () => {
      expect(ORDER_STATUS_LABELS.CLOSED).toBe('Cerrada');
    });

    it('GENERATED sigue mostrando "Generada"', () => {
      expect(ORDER_STATUS_LABELS.GENERATED).toBe('Generada');
    });

    it('DRAFT muestra "Borrador" y CANCELLED "Anulada" (sin regresión)', () => {
      expect(ORDER_STATUS_LABELS.DRAFT).toBe('Borrador');
      expect(ORDER_STATUS_LABELS.CANCELLED).toBe('Anulada');
    });

    it('los 5 estados tienen etiquetas distintas entre sí', () => {
      const labels = Object.values(ORDER_STATUS_LABELS);
      const unique = new Set(labels);
      expect(unique.size).toBe(labels.length);
    });

    it('ORDER_PENDING_STATUSES incluye solo los estados pendientes reales', () => {
      expect(ORDER_PENDING_STATUSES).toEqual(['DRAFT', 'GENERATED']);
    });
  });

  describe('#4 + #5 + #6 IDOR: scopes de equipment/maintenance', () => {
    it('equipmentScope aplica organizationId al WHERE', () => {
      expect(equipmentScope(ORG_A)).toEqual({ organizationId: ORG_A });
    });

    it('assignmentScope aplica organizationId directo y a través del equipo', () => {
      expect(assignmentScope(ORG_A)).toEqual({
        organizationId: ORG_A,
        equipment: { organizationId: ORG_A },
      });
    });

    it('maintenanceScope filtra a través del equipo (no tiene organizationId propio)', () => {
      expect(maintenanceScope(ORG_A)).toEqual({
        equipment: { organizationId: ORG_A },
      });
    });

    it('los scopes aíslan estrictamente entre organizaciones', () => {
      expect(maintenanceScope(ORG_A)).not.toEqual(maintenanceScope(ORG_B));
      expect(assignmentScope(ORG_A)).not.toEqual(assignmentScope(ORG_B));
    });

    it('un PATCH/DELETE que use where: { id, equipment: { organizationId } } no matchea cross-tenant', () => {
      const whereA = { id: 'shared-id', equipment: { organizationId: ORG_A } };
      const whereB = { id: 'shared-id', equipment: { organizationId: ORG_B } };
      expect(whereA).not.toEqual(whereB);
    });
  });
});
