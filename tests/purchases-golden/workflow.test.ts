import { describe, expect, it } from 'vitest';
import type { CompraEstado } from '@prisma/client';
import type { PurchaseOrderStatus } from '@prisma/client';
import type { Role } from '@/types';
import {
  getNextEstado,
  canPerformCompraAction,
  type CompraWorkflowAction,
} from '@/modules/purchases/domain/workflow';
import { canOrdenAction, type OrderAction } from '@/modules/purchases/domain/purchase-order-permissions';
import { officialPermissionSetForRole } from '@/platform/security/authorization/official-role-permissions';
import type { OrganizationRole } from '@/platform/security/authorization/permissions';
import { parsePurchaseOrderListStatus } from '@/modules/purchases/domain/list-status-filter';
import fixture from './__fixtures__/workflow.json';

const COMPRA_ACTIONS = Object.keys(fixture.compraTransitions) as CompraWorkflowAction[];
const COMPRA_ESTADOS = Object.keys(fixture.compraTransitions.generar_orden) as CompraEstado[];

function fixtureRoleToOrgRole(role: string): OrganizationRole {
  if (role === 'RRHH') return 'HR';
  if (role === 'IT') return 'IT_TECHNICIAN';
  return role as OrganizationRole;
}

describe('purchases golden — workflow y permisos', () => {
  it('transiciones legacy CompraSolicitud (workflow.ts)', () => {
    for (const action of COMPRA_ACTIONS) {
      for (const estado of COMPRA_ESTADOS) {
        expect(getNextEstado(action, estado)).toBe(fixture.compraTransitions[action][estado]);
      }
    }
  });

  it('matriz canPerformCompraAction', () => {
    for (const [key, expected] of Object.entries(fixture.compraPermissionMatrix)) {
      const [action, estado, role, ownerPart] = key.split('|');
      const isOwner = ownerPart === 'owner=true';
      expect(canPerformCompraAction(role as Role, action as CompraWorkflowAction, estado as CompraEstado, { isOwner })).toBe(
        expected,
      );
    }
  });

  it('matriz canOrdenAction (permissions.ts)', () => {
    for (const [key, expected] of Object.entries(fixture.orderPermissionMatrix)) {
      const [action, status, role, creatorPart] = key.split('|');
      const isCreator = creatorPart === 'creator=true';
      const permissions = officialPermissionSetForRole(fixtureRoleToOrgRole(role));
      expect(
        canOrdenAction(permissions, action as OrderAction, {
          isCreator,
          status: status as PurchaseOrderStatus,
          membershipRole: fixtureRoleToOrgRole(role),
        }),
      ).toBe(expected);
    }
  });

  it('parsePurchaseOrderListStatus (list-status-filter.ts)', () => {
    expect(parsePurchaseOrderListStatus('active')).toEqual(fixture.listFilters.active);
    expect(parsePurchaseOrderListStatus('closed')).toEqual(fixture.listFilters.closed);
    expect(parsePurchaseOrderListStatus('cancelled')).toEqual(fixture.listFilters.cancelled);
    expect(parsePurchaseOrderListStatus('all')).toEqual(fixture.listFilters.all);
    expect(parsePurchaseOrderListStatus(null)).toEqual(fixture.listFilters.empty);
    expect(parsePurchaseOrderListStatus('GENERADA')).toEqual(fixture.listFilters.legacyGenerada);
    expect(parsePurchaseOrderListStatus('BORRADOR')).toEqual(fixture.listFilters.legacyBorrador);
  });
});
