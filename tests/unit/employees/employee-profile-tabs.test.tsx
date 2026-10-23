import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');

describe('EmployeeProfileView tab visibility', () => {
  it('gates activos, actas and planilla by module read', () => {
    const source = readFileSync(
      resolve(ROOT, 'src/components/employees/EmployeeProfileView.tsx'),
      'utf8',
    );
    expect(source).toMatch(/canEquipmentRead/);
    expect(source).toMatch(/canLicensesRead/);
    expect(source).toMatch(/canPayrollRead/);
    expect(source).toMatch(/TabsTrigger value="historial"/);
  });
});
