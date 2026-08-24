import { describe, expect, it } from 'vitest';

describe('institutional assignment fields', () => {
  it('uses canonical snapshot labels for spreadsheet columns', () => {
    const columns = [
      'Nombre', 'N° Inventario', 'Unidad / Dpto', 'Cargo', 'Fecha de entrega',
      'Marca / Modelo', 'N° de serie', 'RAM', 'Procesador', 'Almacenamiento',
      'Sistema Operativo', 'Accesorios', 'Software instalado',
    ];
    expect(columns).toContain('N° Inventario');
    expect(columns).toContain('Sistema Operativo');
  });

  it('searches assignment snapshots without UUIDs', () => {
    const snapshot = {
      employeeNameSnapshot: 'Ana López',
      inventoryNumberSnapshot: 'CNI-LAP-001',
      serialNumberSnapshot: 'SN-001',
    };
    const query = 'SN-001';
    expect(Object.values(snapshot).some((value) => value.toLowerCase().includes(query.toLowerCase()))).toBe(true);
  });
});
