import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, expectGolden, TEST_JWT_SECRET } from './_helpers';

vi.mock('@/lib/prisma', async () => (await import('./_helpers')).prismaModuleMock());

const { GET } = await import('@/app/api/reports/[code]/export/route');

const NOW = new Date('2026-10-15T15:30:00.000Z');

const SAMPLE: Record<string, unknown[]> = {
  compraOrden: [
    {
      orderNumber: 'OC-2026-0001',
      requestDate: new Date('2026-03-02T00:00:00.000Z'),
      status: 'ISSUED',
      supplierName: 'Papelería Central S. de R.L.',
      supplierRtn: '08011999123456',
      subtotal: '1500.00',
      discount: '100.00',
      tax: '210.00',
      total: '1610.00',
    },
    {
      orderNumber: null,
      requestDate: new Date('2026-04-10T00:00:00.000Z'),
      status: 'DRAFT',
      supplierName: 'Ferretería Norte',
      supplierRtn: null,
      subtotal: 300,
      discount: 0,
      tax: 45,
      total: 345,
    },
  ],
  equipment: [
    {
      inventoryCode: 'CNI-LAP-001',
      category: 'LAPTOP',
      brand: 'Dell',
      model: 'Latitude 5440',
      serialNumber: 'SN-123',
      status: 'ASSIGNED',
      purchaseDate: new Date('2026-01-20T00:00:00.000Z'),
      assignments: [
        { employeeNameSnapshot: 'Ana López', employeeNameAtTime: null, departmentSnapshot: 'Finanzas', departmentAtTime: null },
      ],
    },
    {
      inventoryCode: 'CNI-MON-002',
      category: 'MONITOR',
      brand: 'LG',
      model: '24MK',
      serialNumber: null,
      status: 'AVAILABLE',
      purchaseDate: new Date('2026-02-01T00:00:00.000Z'),
      assignments: [],
    },
  ],
  oficio: [
    {
      number: 'CNI-OF-001-2026',
      type: 'OUTGOING',
      oficioDate: new Date('2026-05-05T00:00:00.000Z'),
      senderName: 'Dirección Ejecutiva',
      preparedBy: 'Secretaría',
      recipientName: 'Ministerio de Finanzas',
      recipient: 'SEFIN',
      subject: 'Solicitud de información',
      status: 'SENT',
      scope: 'EXTERNAL',
    },
    {
      number: 'CNI-IN-010-2026',
      type: 'INCOMING',
      oficioDate: new Date('2026-05-06T00:00:00.000Z'),
      senderName: null,
      preparedBy: null,
      recipientName: null,
      recipient: 'Dirección',
      subject: 'Respuesta',
      status: 'RECEIVED',
      scope: 'INTERNAL',
    },
  ],
  equipmentAssignment: [
    {
      assignedDate: new Date('2026-06-01T14:00:00.000Z'),
      returnedDate: null,
      status: 'ACTIVE',
      employeeNameSnapshot: 'Ana López',
      employeeNameAtTime: null,
      departmentSnapshot: 'Finanzas',
      departmentAtTime: null,
      equipment: { inventoryCode: 'CNI-LAP-001' },
    },
    {
      assignedDate: new Date('2026-06-03T10:00:00.000Z'),
      returnedDate: new Date('2026-06-20T10:00:00.000Z'),
      status: 'RETURNED',
      employeeNameSnapshot: null,
      employeeNameAtTime: 'Luis Pérez',
      departmentSnapshot: null,
      departmentAtTime: 'IT',
      equipment: { inventoryCode: 'CNI-MON-002' },
    },
  ],
  equipmentDisposal: [
    {
      status: 'APPROVED',
      disposalResult: 'DISPOSAL_JUSTIFIED',
      submittedAt: new Date('2026-07-01T12:00:00.000Z'),
      approvedAt: new Date('2026-07-03T12:00:00.000Z'),
      createdAt: new Date('2026-06-30T12:00:00.000Z'),
      equipment: { inventoryCode: 'CNI-LAP-009' },
      evaluatedBy: { firstName: 'Carlos', lastName: 'Ruiz', email: 'cruiz@cni.hn' },
      approvedBy: { firstName: 'María', lastName: 'Díaz', email: 'mdiaz@cni.hn' },
    },
    {
      status: 'DRAFT',
      disposalResult: null,
      submittedAt: null,
      approvedAt: null,
      createdAt: new Date('2026-07-10T12:00:00.000Z'),
      equipment: { inventoryCode: 'CNI-UPS-003' },
      evaluatedBy: { firstName: '', lastName: '', email: 'tecnico@cni.hn' },
      approvedBy: null,
    },
  ],
};

const CODES: Record<string, string> = {
  PURCHASE_ORDER_SUMMARY: 'compraOrden',
  EQUIPMENT_INVENTORY: 'equipment',
  OFFICE_REGISTER: 'oficio',
  EQUIPMENT_ASSIGNMENT_HISTORY: 'equipmentAssignment',
  EQUIPMENT_DISPOSAL_SUMMARY: 'equipmentDisposal',
};

function token() {
  return jwt.sign({ userId: 'user-admin', email: 'admin@cni.hn', role: 'ADMIN' }, TEST_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
    issuer: 'sge',
    audience: 'sge-web',
  });
}

function setupDb() {
  db.on('user.findUnique', () => ({ id: 'user-admin', isActive: true, passwordChangedAt: null, role: 'ADMIN' }));
  db.on('user.findFirst', () => ({ id: 'user-admin', email: 'admin@cni.hn' }));
  db.on('organizationMembership.findMany', () => [
    {
      id: 'm-1',
      userId: 'user-admin',
      organizationId: 'org_cni_default',
      role: 'ADMIN',
      status: 'ACTIVE',
      organization: { id: 'org_cni_default', slug: 'cni', status: 'ACTIVE' },
    },
  ]);
  db.on('organizationMembership.findUnique', () => ({
    id: 'm-1',
    role: 'ADMIN',
    status: 'ACTIVE',
    accessVersion: 0,
    organizationId: 'org_cni_default',
    userId: 'user-admin',
    organization: { id: 'org_cni_default', status: 'ACTIVE', name: 'CNI', timezone: 'America/Tegucigalpa' },
  }));
  db.on('organizationMembership.findFirst', () => ({
    id: 'm-1',
    role: 'ADMIN',
    status: 'ACTIVE',
    organizationId: 'org_cni_default',
    organization: { id: 'org_cni_default', status: 'ACTIVE', name: 'CNI', timezone: 'America/Tegucigalpa' },
  }));
  db.on('organization.findUnique', () => ({ id: 'org_cni_default', name: 'Consejo Nacional de Inversiones', status: 'ACTIVE', timezone: 'America/Tegucigalpa' }));
  db.on('reportExecution.create', () => ({ id: 'exec-1' }));
  db.on('reportExecution.update', () => ({ id: 'exec-1' }));
  db.on('reportExecution.updateMany', () => ({ count: 1 }));
  for (const model of Object.values(CODES)) {
    db.on(`${model}.count`, () => SAMPLE[model].length);
    db.on(`${model}.findMany`, () => SAMPLE[model]);
  }
}

function request(code: string, query: string) {
  return new NextRequest(`http://localhost/api/reports/${code}/export?${query}`, {
    method: 'GET',
    headers: { cookie: `token=${token()}` },
  });
}

async function call(code: string, query: string) {
  return GET(request(code, query), { params: Promise.resolve({ code }) });
}

let previousSecret: string | undefined;
beforeAll(() => {
  previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterAll(() => {
  vi.useRealTimers();
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});
beforeEach(() => {
  db.reset();
  setupDb();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('platform golden — /api/reports/[code]/export', () => {
  for (const [code, model] of Object.entries(CODES)) {
    it(`${code}: CSV (columnas, encabezados, filas) y filtros`, async () => {
      const res = await call(code.toLowerCase(), 'format=csv&from=2026-01-01&to=2026-12-31');
      const csv = await res.text();
      const countArgs = db.fn(`${model}.count`).mock.calls[0]?.[0];
      const findArgs = db.fn(`${model}.findMany`).mock.calls[0]?.[0] as Record<string, unknown> | undefined;
      expectGolden(
        'reports-export',
        code,
        {
          status: res.status,
          contentType: res.headers.get('Content-Type'),
          disposition: res.headers.get('Content-Disposition'),
          csv,
          countWhere: (countArgs as { where?: unknown } | undefined)?.where,
          findMany: findArgs ? { orderBy: findArgs.orderBy, take: findArgs.take, select: findArgs.select } : null,
        },
        (a, b) => expect(a).toEqual(b),
      );
    });

    it(`${code}: XLSX`, async () => {
      const res = await call(code, 'format=xlsx&from=2026-01-01&to=2026-12-31');
      const body = new Uint8Array(await res.arrayBuffer());
      expectGolden(
        'reports-export',
        `${code}_xlsx`,
        {
          status: res.status,
          contentType: res.headers.get('Content-Type'),
          disposition: res.headers.get('Content-Disposition'),
          isZip: body[0] === 0x50 && body[1] === 0x4b,
        },
        (a, b) => expect(a).toEqual(b),
      );
    });
  }

  it('filtros por estado/categoría/tipo y errores', async () => {
    const results: Record<string, unknown> = {};
    const cases: Array<[string, string, string]> = [
      ['purchaseIssued', 'PURCHASE_ORDER_SUMMARY', 'from=2026-01-01&to=2026-12-31&status=ISSUED'],
      ['purchaseBadStatus', 'PURCHASE_ORDER_SUMMARY', 'from=2026-01-01&to=2026-12-31&status=NOPE'],
      ['equipmentFiltered', 'EQUIPMENT_INVENTORY', 'from=2026-01-01&to=2026-12-31&status=ASSIGNED&category=LAPTOP'],
      ['equipmentBadCategory', 'EQUIPMENT_INVENTORY', 'from=2026-01-01&to=2026-12-31&category=TOASTER'],
      ['oficioType', 'OFFICE_REGISTER', 'from=2026-01-01&to=2026-12-31&type=OUTGOING&status=SENT'],
      ['oficioBadType', 'OFFICE_REGISTER', 'from=2026-01-01&to=2026-12-31&type=FAX'],
      ['badRange', 'EQUIPMENT_INVENTORY', 'from=2026-12-31&to=2026-01-01'],
      ['badDate', 'EQUIPMENT_INVENTORY', 'from=2026-13-01&to=2026-12-31'],
      ['unknownParam', 'EQUIPMENT_INVENTORY', 'from=2026-01-01&to=2026-12-31&foo=1'],
      ['unsupportedFormat', 'EQUIPMENT_INVENTORY', 'format=pdf&from=2026-01-01&to=2026-12-31'],
      ['unknownReport', 'NOT_A_REPORT', 'from=2026-01-01&to=2026-12-31'],
    ];
    for (const [name, code, query] of cases) {
      db.reset();
      setupDb();
      const res = await call(code, query);
      const isJson = (res.headers.get('Content-Type') ?? '').includes('json');
      const body = isJson ? await res.json() : await res.text();
      const model = CODES[code];
      results[name] = {
        status: res.status,
        body: isJson ? { error: body.error, code: body.code, hasDetails: 'details' in body } : body,
        countWhere: model ? (db.fn(`${model}.count`).mock.calls[0]?.[0] as { where?: unknown } | undefined)?.where ?? null : null,
      };
    }
    expectGolden('reports-export', 'filters', results, (a, b) => expect(a).toEqual(b));
  });

  it('límite de filas (413) y auditoría', async () => {
    db.on('equipment.count', () => 1_000_000);
    const tooLarge = await call('EQUIPMENT_INVENTORY', 'from=2026-01-01&to=2026-12-31');
    db.reset();
    setupDb();
    await call('EQUIPMENT_INVENTORY', 'from=2026-01-01&to=2026-12-31');
    const audit = db.fn('auditRecord.create').mock.calls.map(([args]) => {
      const { title, description, module, category, newData } = (args as { data: Record<string, unknown> }).data;
      return { title, description, module, category, newData };
    });
    expectGolden(
      'reports-export',
      'limitsAndAudit',
      { tooLarge: { status: tooLarge.status, body: await tooLarge.json() }, audit },
      (a, b) => expect(a).toEqual(b),
    );
  });
});
