import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCHEMA_PATH = join(process.cwd(), 'prisma', 'schema.prisma');

function readSchema(): string {
  return readFileSync(SCHEMA_PATH, 'utf-8');
}

function extractModelBlock(schema: string, modelName: string): string | null {
  const re = new RegExp(`model\\s+${modelName}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const match = schema.match(re);
  return match ? match[1] : null;
}

function hasField(model: string, field: string): boolean {
  const schema = readSchema();
  const block = extractModelBlock(schema, model);
  if (!block) return false;
  const pattern = new RegExp(`\\b${field}\\b\\s+\\w`);
  return pattern.test(block);
}

function hasIndex(model: string, columns: string[]): boolean {
  const schema = readSchema();
  const block = extractModelBlock(schema, model);
  if (!block) return false;
  const cols = columns.map((c) => `[\`"]?${c}[\`"]?`).join('\\s*,\\s*');
  const pattern = new RegExp(`@@index\\(\\[\\s*${cols}`, 'i');
  return pattern.test(block);
}

function hasUnique(model: string, columns: string[]): boolean {
  const schema = readSchema();
  const block = extractModelBlock(schema, model);
  if (!block) return false;
  const cols = columns.map((c) => `[\`"]?${c}[\`"]?`).join('\\s*,\\s*');
  const pattern = new RegExp(`@@unique\\(\\[\\s*${cols}`, 'i');
  return pattern.test(block);
}

describe('Schema data-quality invariants (Phase 10A)', () => {
  it('every business table has an organizationId column', () => {
    for (const model of ['Equipment', 'EquipmentAssignment', 'Oficio', 'Audit', 'Ticket', 'AuditRecord', 'CompraOrden', 'EquipmentDisposal', 'Department', 'Proveedor', 'Notification', 'OrganizationIntegration', 'IntegrationExecution']) {
      expect(hasField(model, 'organizationId'), `${model} missing organizationId`).toBe(true);
    }
  });

  it('Organization has a unique slug', () => {
    const schema = readSchema();
    const block = extractModelBlock(schema, 'Organization');
    expect(block).toBeDefined();
    expect(block).toMatch(/slug\s+String\s+@unique/);
  });

  it('OrganizationMembership has a unique (organizationId, userId) pair', () => {
    expect(hasUnique('OrganizationMembership', ['organizationId', 'userId'])).toBe(true);
  });

  it('Notification has a unique (organizationId, idempotencyKey) pair', () => {
    expect(hasUnique('Notification', ['organizationId', 'idempotencyKey'])).toBe(true);
  });

  it('OrganizationIntegration has a unique (organizationId, provider, name) tuple', () => {
    expect(hasUnique('OrganizationIntegration', ['organizationId', 'provider', 'name'])).toBe(true);
  });

  it('DomainEventOutbox has a unique (organizationId, aggregateType, aggregateId, aggregateVersion, eventType) tuple', () => {
    expect(hasUnique('DomainEventOutbox', ['organizationId', 'aggregateType', 'aggregateId', 'aggregateVersion', 'eventType'])).toBe(true);
  });

  it('integration_executions has the (integrationId, startedAt) index', () => {
    expect(hasIndex('IntegrationExecution', ['integrationId', 'startedAt'])).toBe(true);
  });

  it('notifications has the (organizationId, userId, createdAt) index', () => {
    expect(hasIndex('Notification', ['organizationId', 'userId', 'createdAt'])).toBe(true);
  });

  it('User has a unique email and a unique employeeNumber', () => {
    const schema = readSchema();
    const block = extractModelBlock(schema, 'User');
    expect(block).toBeDefined();
    expect(block).toMatch(/email\s+String\s+@unique/);
    expect(block).toMatch(/employeeNumber\s+String\s+@unique/);
  });

  it('User has a platformRole column (Phase 6A)', () => {
    expect(hasField('User', 'platformRole')).toBe(true);
  });

  it('Organization has the Phase 7A onboardingStatus column', () => {
    expect(hasField('Organization', 'onboardingStatus')).toBe(true);
  });
});

describe('Schema enum coverage (Phase 10A)', () => {
  it('declares the lifecycle statuses required by Phase 7A', () => {
    const schema = readSchema();
    expect(schema).toMatch(/enum\s+OrganizationStatus\s*\{[\s\S]*PROVISIONING/);
    expect(schema).toMatch(/enum\s+OrganizationStatus\s*\{[\s\S]*ARCHIVED/);
    expect(schema).toMatch(/enum\s+OrganizationStatus\s*\{[\s\S]*PENDING_DELETION/);
  });

  it('declares the platform role enum', () => {
    const schema = readSchema();
    expect(schema).toMatch(/enum\s+PlatformRole\s*\{[\s\S]*PLATFORM_ADMIN/);
    expect(schema).toMatch(/enum\s+PlatformRole\s*\{[\s\S]*SUPPORT_ADMIN/);
  });

  it('declares the notification channel and status enums (Phase 8A)', () => {
    const schema = readSchema();
    expect(schema).toMatch(/enum\s+NotificationChannel\s*\{[\s\S]*IN_APP/);
    expect(schema).toMatch(/enum\s+NotificationChannel\s*\{[\s\S]*EMAIL/);
    expect(schema).toMatch(/enum\s+NotificationStatus\s*\{[\s\S]*SENT/);
  });

  it('declares the integration status and capability enums (Phase 9A)', () => {
    const schema = readSchema();
    expect(schema).toMatch(/enum\s+IntegrationStatus\s*\{[\s\S]*ACTIVE/);
    expect(schema).toMatch(/enum\s+IntegrationCapability\s*\{[\s\S]*EMAIL_SEND/);
    expect(schema).toMatch(/enum\s+IntegrationCapability\s*\{[\s\S]*IDENTITY_LOGIN/);
  });
});

describe('Schema safety — no business data without organization (Phase 10A)', () => {
  const businessTables = [
    'Equipment',
    'EquipmentAssignment',
    'Oficio',
    'Audit',
    'Ticket',
    'AuditRecord',
    'CompraOrden',
    'EquipmentDisposal',
    'Department',
    'Proveedor',
    'Notification',
    'OrganizationIntegration',
    'IntegrationExecution',
  ];
  for (const table of businessTables) {
    it(`${table} enforces NOT NULL on organizationId`, () => {
      const schema = readSchema();
      const block = extractModelBlock(schema, table);
      expect(block).toBeDefined();
      expect(block).toMatch(/organizationId\s+String(?!\?)/);
    });
  }
});
