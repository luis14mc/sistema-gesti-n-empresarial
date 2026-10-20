import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRoute(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8');
}

describe('planilla email API routes (RBAC contracts)', () => {
  it('requires payroll.generate to send payslips', () => {
    const route = readRoute('src/app/api/planilla/boletas/enviar/route.ts');
    expect(route).toMatch(/authorizeOrganization\(req, requestId, 'payroll\.generate'\)/);
  });

  it('requires payroll.configure for SMTP status and test', () => {
    const status = readRoute('src/app/api/planilla/configuracion/smtp/route.ts');
    const test = readRoute('src/app/api/planilla/configuracion/smtp/probar/route.ts');
    expect(status).toMatch(/authorizeOrganization\(req, requestId, 'payroll\.configure'\)/);
    expect(test).toMatch(/authorizeOrganization\(req, requestId, 'payroll\.configure'\)/);
  });
});
