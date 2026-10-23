import { describe, expect, it } from 'vitest';

import {
  buildAssignmentActaHtml,
  buildDischargeActaHtml,
  buildReturnActaHtml,
} from '@/modules/equipment/infrastructure/acta-html';
import { isSubstitutionReturnReason } from '@/modules/equipment/domain/acta-texts';

const recipient = {
  name: 'Ana Ficticia López',
  position: 'Analista de sistemas',
  department: 'Informática y Tecnología',
};

const deliverer = {
  name: 'Carlos Ficticio Mejía',
  position: 'Jefe de activos',
  department: 'Dirección Administrativa',
};

const equipment = {
  brand: 'Dell',
  model: 'Latitude 5540',
  serialNumber: 'SN-FICT-001',
  inventoryNumber: 'CNI-IT-0001',
  ram: '16 GB',
  processor: 'Intel i7',
  storage: '512 GB SSD',
  operatingSystem: 'Windows 11',
  accessories: 'Cargador, mouse',
  softwareInstalled: 'Microsoft 365, Antivirus institucional',
};

describe('actas CNI HTML', () => {
  const documentDate = new Date('2026-08-10T12:00:00-06:00');

  it('acta de asignación incluye encabezado CNI y condiciones', async () => {
    const html = buildAssignmentActaHtml({
      documentDate,
      recipient,
      deliverer,
      equipment,
      equipmentDeliveryState: 'nuevo',
    });
    expect(html).toMatchSnapshot();
    expect(html).toContain('CONSEJO NACIONAL DE INVERSIONES (CNI)');
    expect(html).toContain('Asignación de equipo de cómputo');
    expect(html).toContain('El equipo se entrega nuevo');
    expect(html).toContain('Ana Ficticia López');
  });

  it('acta de devolución — motivo sustitución', async () => {
    const html = buildReturnActaHtml({
      documentDate,
      recipient,
      deliverer,
      returnReason: 'Sustitución / cambio de equipo',
      equipment,
    });
    expect(html).toMatchSnapshot();
    expect(html).toContain('sustitución y reasignación');
    expect(html).toContain('Firma de quien entrega');
    expect(html).toContain('Firma de quien recibe');
  });

  it('acta de devolución — otro motivo', async () => {
    const html = buildReturnActaHtml({
      documentDate,
      recipient,
      deliverer,
      returnReason: 'Traslado de funciones',
      equipment,
    });
    expect(html).toContain('por motivo de Traslado de funciones');
    expect(isSubstitutionReturnReason('Traslado de funciones')).toBe(false);
  });

  it('acta de descargo enmascara licencia DEVICE en filas del formulario', async () => {
    const html = buildDischargeActaHtml({
      documentDate,
      terminationDate: documentDate,
      workerName: 'Ana Ficticia López',
      workerDni: '0801-1990-12345',
      workerPosition: 'Analista',
      deliverer,
      equipmentRows: [{ Ítem: 'LAPTOP', 'Marca/Modelo': 'Dell Latitude', Serie: 'SN-1', Observaciones: '' }],
      accessoryRows: [],
      licenseRows: [
        {
          Software: 'Windows',
          'N.º de licencia': '•••••AB12X',
          Observaciones: '',
        },
      ],
      accessRows: [],
      miscRows: [],
    });
    expect(html).toMatchSnapshot();
    expect(html).toContain('•••••AB12X');
    expect(html).not.toContain('SUPER-SECRET-LICENSE-KEY-12345');
    expect(html).toContain('ACTA DE DESCARGO Y DEVOLUCIÓN DE EQUIPO');
  });
});
