import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('equipment Excel route security contracts', () => {
  const importRoute = read('src/app/api/equipment/import/route.ts');
  const templateRoute = read('src/app/api/equipment/import/template/route.ts');
  const exportRoute = read('src/app/api/equipment/export/route.ts');

  it('requires authentication and equipment-create permission for import and template', () => {
    expect(importRoute).toMatch(/withAuth\(postHandler\)/);
    expect(templateRoute).toMatch(/withAuth\(getHandler\)/);
    expect(importRoute).toMatch(/'equipment\.create'/);
    expect(templateRoute).toMatch(/'equipment\.create'/);
  });

  it('requires authentication and equipment-read permission for export', () => {
    expect(exportRoute).toMatch(/withAuth\(getHandler\)/);
    expect(exportRoute).toMatch(/'equipment\.read'/);
  });

  it('derives organization scope from authenticated context and never reads it from input', () => {
    for (const route of [importRoute, templateRoute, exportRoute]) {
      expect(route).toMatch(/requireOrganizationContext/);
      expect(route).not.toMatch(/searchParams\.get\(['"]organizationId/);
      expect(route).not.toMatch(/form\.get\(['"]organizationId/);
    }
  });

  it('enforces upload type and size and records required audit actions', () => {
    expect(importRoute).toMatch(/EQUIPMENT_IMPORT_MAX_BYTES/);
    expect(importRoute).toMatch(/\.endsWith\('\.xlsx'\)/);
    expect(importRoute).toMatch(/EQUIPMENT_BULK_IMPORT/);
    expect(exportRoute).toMatch(/EQUIPMENT_EXPORT/);
  });

  it('uses canonical creation and canonical code generation for blank codes', () => {
    const importer = read('src/modules/equipment/import-export/equipment-import.ts');
    const creator = read('src/modules/equipment/import-export/equipment-create.ts');
    expect(importer).toMatch(/createEquipmentRecord/);
    expect(creator).toMatch(/data\.inventoryCode \|\| data\.assetCode \|\| await generateAssetCode/);
    expect(creator).toMatch(/generateAssetCode\(context\.organizationId, category, tx\)/);
  });
});
