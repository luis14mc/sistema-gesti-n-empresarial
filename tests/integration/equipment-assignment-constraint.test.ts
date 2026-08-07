import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { describeWithDatabase, cleanupTestTenant } from '../helpers/database';
import { isActiveAssignmentConflict } from '@/modules/equipment/assignment-errors';

/**
 * Phase 13 · Part 1 — REAL PostgreSQL integration tests for the invariant:
 *   ONE EQUIPMENT ITEM MAY HAVE AT MOST ONE ACTIVE ASSIGNMENT.
 *
 * Prisma is NOT mocked. Requires the live test harness (SGE_LIVE_DB=true) with
 * migration 20260803120000_equipment_assignment_active_unique applied — i.e.
 * `pnpm test:integration` against an isolated test database (never production).
 * When SGE_LIVE_DB is unset these are skipped (see describeWithDatabase).
 */

describeWithDatabase('EquipmentAssignment active-unique constraint', () => {
  const orgA = `test-org-a-${randomUUID()}`;
  const orgB = `test-org-b-${randomUUID()}`;
  let userId = '';
  let employeeId = '';
  let equipmentId = '';
  let equipmentBId = '';

  const activeData = (equipId: string) => ({
    equipmentId: equipId,
    organizationId: orgA,
    employeeId,
    assignedById: userId,
    status: 'ACTIVE' as const,
  });

  beforeAll(async () => {
    for (const id of [orgA, orgB]) {
      await prisma.organization.create({
        data: {
          id, name: id, slug: id, status: 'ACTIVE', onboardingStatus: 'COMPLETED',
          timezone: 'America/Tegucigalpa', locale: 'es-HN', currency: 'HNL',
        },
      });
    }
    const user = await prisma.user.create({
      data: {
        employeeNumber: `EMP-${randomUUID().slice(0, 8)}`,
        email: `assign-${randomUUID()}@test.local`,
        password: 'x', firstName: 'Test', lastName: 'User', role: 'ADMIN', isActive: true,
      },
    });
    userId = user.id;
    const employee = await prisma.employee.create({
      data: {
        organizationId: orgA,
        firstName: 'Emp', lastName: 'Loyee', fullName: 'Emp Loyee',
        email: `emp-${randomUUID()}@test.local`,
      },
    });
    employeeId = employee.id;
    const eq = await prisma.equipment.create({
      data: {
        inventoryCode: `INV-${randomUUID().slice(0, 8)}`, type: 'PC', brand: 'B', model: 'M',
        category: 'DESKTOP_PC', status: 'AVAILABLE', organizationId: orgA,
      },
    });
    equipmentId = eq.id;
    const eqB = await prisma.equipment.create({
      data: {
        inventoryCode: `INV-${randomUUID().slice(0, 8)}`, type: 'PC', brand: 'B', model: 'M',
        category: 'DESKTOP_PC', status: 'AVAILABLE', organizationId: orgA,
      },
    });
    equipmentBId = eqB.id;
  });

  afterAll(async () => {
    await cleanupTestTenant(orgA);
    await cleanupTestTenant(orgB);
    await prisma.employee.deleteMany({ where: { id: employeeId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
  });

  it('1. one active assignment succeeds', async () => {
    const a = await prisma.equipmentAssignment.create({ data: activeData(equipmentId) });
    expect(a.status).toBe('ACTIVE');
  });

  it('2. a second active assignment for the same equipment fails (P2002)', async () => {
    let caught: unknown;
    try {
      await prisma.equipmentAssignment.create({ data: activeData(equipmentId) });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((caught as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
    expect(isActiveAssignmentConflict(caught)).toBe(true);
  });

  it('4. returning the equipment closes the active assignment', async () => {
    await prisma.equipmentAssignment.updateMany({
      where: { equipmentId, status: 'ACTIVE' },
      data: { status: 'RETURNED', returnedDate: new Date() },
    });
    const active = await prisma.equipmentAssignment.count({ where: { equipmentId, status: 'ACTIVE' } });
    expect(active).toBe(0);
  });

  it('5. after return a new assignment may be created', async () => {
    const a = await prisma.equipmentAssignment.create({ data: activeData(equipmentId) });
    expect(a.status).toBe('ACTIVE');
    // reset for later independence
    await prisma.equipmentAssignment.updateMany({
      where: { equipmentId, status: 'ACTIVE' }, data: { status: 'RETURNED', returnedDate: new Date() },
    });
  });

  it('3 & 7. concurrent/racing inserts yield exactly one active assignment (DB is the guard)', async () => {
    // Fire N concurrent creates that all bypass any application pre-check and
    // hit the table directly. The partial unique index must let exactly one win.
    const attempts = 8;
    const results = await Promise.allSettled(
      Array.from({ length: attempts }, () =>
        prisma.equipmentAssignment.create({ data: activeData(equipmentBId) }),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const conflicts = results.filter(
      (r) => r.status === 'rejected' && isActiveAssignmentConflict((r as PromiseRejectedResult).reason),
    );
    expect(ok).toHaveLength(1);
    expect(conflicts).toHaveLength(attempts - 1);

    const activeCount = await prisma.equipmentAssignment.count({
      where: { equipmentId: equipmentBId, status: 'ACTIVE' },
    });
    expect(activeCount).toBe(1);
  });

  it('6. the constraint is per equipment; a different org cannot smuggle a second active row', async () => {
    // equipmentBId belongs to orgA and already has 1 active row. An attempt to
    // create another ACTIVE row for it — even labelled with a different org —
    // is still rejected, because the invariant is per equipment item.
    let caught: unknown;
    try {
      await prisma.equipmentAssignment.create({
        data: { equipmentId: equipmentBId, organizationId: orgB, employeeId, assignedById: userId, status: 'ACTIVE' },
      });
    } catch (e) {
      caught = e;
    }
    expect(isActiveAssignmentConflict(caught)).toBe(true);
  });
});
