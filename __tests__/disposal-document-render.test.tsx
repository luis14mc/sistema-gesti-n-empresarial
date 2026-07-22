import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DisposalDocument, type DisposalDocumentData } from '@/modules/equipment-disposal/presentation/components/DisposalDocument';

const data: DisposalDocumentData = {
  folio: 'DICT-BAJA-2026-00001', statusLabel: 'BORRADOR', institutionName: 'CNI', inventoryCode: 'TI-001',
  serialNumber: 'SER-1', equipmentDescription: 'Marca Modelo', department: 'TI', purchaseDate: '1/1/2020',
  purchasePrice: 'L 1,000.00', estimatedRepairCost: 'L 800.00', estimatedReplacementPrice: 'L 1,200.00',
  physicalCondition: 'CRITICAL', functionalCondition: 'INOPERABLE', securitySupportStatus: 'VULNERABLE',
  evaluationScore: 90, disposalResult: 'DISPOSAL_JUSTIFIED', rationales: ['Costo de reparación elevado.'],
  signatureTitle: 'APROBACIÓN INSTITUCIONAL', footerText: 'Documento institucional',
};

describe('DisposalDocument', () => {
  it('renders the shared server-safe institutional document', () => {
    const html = renderToStaticMarkup(<DisposalDocument data={data} draft />);
    expect(html).toContain('DICTAMEN TÉCNICO DE BAJA');
    expect(html).toContain('DICT-BAJA-2026-00001');
    expect(html).toContain('BORRADOR');
    expect(html).toContain('Aptos');
    expect(html).toContain('Espacio para sello institucional');
    expect(html).toContain('L 800.00');
  });
});
