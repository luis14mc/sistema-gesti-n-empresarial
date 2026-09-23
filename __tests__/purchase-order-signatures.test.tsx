import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PurchaseOrderDocument } from '@/components/compras/document/PurchaseOrderDocument';
import {
  buildPreviewDataFromInput,
  buildPreviewDataFromSerializedOrder,
  formatSignatureAttribution,
} from '@/lib/compras/orden/preview-data';
import type { PurchaseOrderTemplateConfig } from '@/lib/compras/orden/template-config';
import { can, organizationRole, PURCHASE_ORDER_APPROVE } from '@/platform/security/authorization/permissions';

const format: PurchaseOrderTemplateConfig = {
  id: 'tpl-1',
  version: 1,
  logoUrl: null,
  institutionName: 'Consejo Nacional de Inversiones',
  institutionAddress: '',
  institutionPhone: '',
  institutionWebsite: '',
  institutionRtn: '',
  documentTitle: 'SOLICITUD Y ORDEN DE COMPRA',
  signatureTitle: 'Jefe de Presupuesto',
  orderPrefix: 'COM-CNI',
  footerText: '',
  additionalNote: '',
  primaryColor: '#123456',
  secondaryColor: '#abcdef',
  showInstitutionAddress: false,
  showInstitutionPhone: false,
  showInstitutionWebsite: false,
  showInstitutionRtn: false,
  showReference: true,
  showRequiredDate: true,
};

describe('purchase order signature attribution', () => {
  it('formats pending and completed signature lines', () => {
    expect(formatSignatureAttribution('Aprobado por')).toBe('Aprobado por: Pendiente');
    expect(formatSignatureAttribution('Generado por', 'Yenfri Garcia', '2026-09-09T18:00:00.000Z')).toMatch(
      /^Generado por: Yenfri Garcia · /,
    );
  });

  it('shows pending attribution in draft preview and the same layout as the final document', () => {
    const draft = buildPreviewDataFromInput({
      purchaseReference: 'REF-1',
      requestDate: '2026-09-01',
      requiredDate: '2026-09-10',
      requestedByName: 'Solicitante',
      requesterJobTitle: 'Analista',
      supplierName: 'Proveedor',
      supplierRtn: '08011999123456',
      supplierPhone: '2222-0000',
      purchaseJustification: 'Compra de papelería',
      items: [{ description: 'Resmas', unit: 'UNIT', quantity: 1, unitPrice: 100 }],
    }, format);

    const generated = buildPreviewDataFromSerializedOrder({
      orderNumber: 'COM-CNI-2026-00001',
      purchaseReference: 'REF-1',
      requestDate: '2026-09-01T00:00:00.000Z',
      requiredDate: '2026-09-10T00:00:00.000Z',
      requestedByName: 'Solicitante',
      requesterJobTitle: 'Analista',
      supplierName: 'Proveedor',
      supplierRtn: '08011999123456',
      supplierPhone: '2222-0000',
      purchaseJustification: 'Compra de papelería',
      subtotal: 100,
      discount: 0,
      tax: 15,
      total: 115,
      status: 'GENERATED',
      generatedByName: 'Yenfri Lemarie Garcia',
      generatedAt: '2026-09-09T18:00:00.000Z',
      items: [{
        itemNumber: 1, description: 'Resmas', unit: 'UNIT', quantity: 1, unitPrice: 100, total: 100,
        taxProfile: 'GENERAL_15', taxableBase: 100, taxAmount: 15, itemTotal: 115, taxLabel: 'ISV 15%',
        taxes: [{ code: 'ISV_15', name: 'ISV 15%', rate: 15, taxableBase: 100, amount: 15 }],
      }],
    }, format);

    const draftHtml = renderToStaticMarkup(
      <PurchaseOrderDocument order={draft} format={format} draft />,
    );
    const generatedHtml = renderToStaticMarkup(
      <PurchaseOrderDocument order={generated} format={format} />,
    );

    expect(draftHtml).toContain('Yenfri Garcia');
    expect(draftHtml).toContain('Lila Rivera');
    expect(draftHtml).toContain('Generado por: Pendiente');
    expect(draftHtml).toContain('Aprobado por: Pendiente');

    expect(generatedHtml).toContain('Yenfri Garcia');
    expect(generatedHtml).toContain('Lila Rivera');
    expect(generatedHtml).toContain('Generado por: Yenfri Lemarie Garcia');
    expect(generatedHtml).toContain('Aprobado por: Pendiente');
  });

  it('renders generated and approved attribution with both dates on the issued document', () => {
    const issued = buildPreviewDataFromSerializedOrder({
      orderNumber: 'COM-CNI-2026-00001',
      purchaseReference: 'REF-1',
      requestDate: '2026-09-01T00:00:00.000Z',
      requiredDate: '2026-09-10T00:00:00.000Z',
      requestedByName: 'Solicitante',
      requesterJobTitle: 'Analista',
      supplierName: 'Proveedor',
      supplierRtn: '08011999123456',
      supplierPhone: '2222-0000',
      purchaseJustification: 'Compra de papelería',
      subtotal: 100,
      discount: 0,
      tax: 15,
      total: 115,
      status: 'ISSUED',
      generatedByName: 'Yenfri Lemarie Garcia',
      generatedAt: '2026-09-09T18:00:00.000Z',
      issuedByName: 'Lila Margarita Rivera',
      issuedAt: '2026-09-10T15:30:00.000Z',
      items: [{
        itemNumber: 1, description: 'Resmas', unit: 'UNIT', quantity: 1, unitPrice: 100, total: 100,
        taxProfile: 'GENERAL_15', taxableBase: 100, taxAmount: 15, itemTotal: 115, taxLabel: 'ISV 15%',
        taxes: [{ code: 'ISV_15', name: 'ISV 15%', rate: 15, taxableBase: 100, amount: 15 }],
      }],
    }, format);

    const issuedHtml = renderToStaticMarkup(
      <PurchaseOrderDocument order={issued} format={format} />,
    );

    expect(issuedHtml).toContain('Yenfri Garcia');
    expect(issuedHtml).toContain('Lila Rivera');
    expect(issuedHtml).toMatch(/Generado por: Yenfri Lemarie Garcia · /);
    expect(issuedHtml).toMatch(/Aprobado por: Lila Margarita Rivera · /);
    expect(issuedHtml).not.toContain('Aprobado por: Pendiente');
  });

  it('grants PURCHASE_ORDER_APPROVE to admin profiles, not procurement', () => {
    expect(PURCHASE_ORDER_APPROVE).toBe('purchase-orders.approve');
    expect(can(organizationRole('ADMIN'), PURCHASE_ORDER_APPROVE)).toBe(true);
    expect(can(organizationRole('ADMINISTRACION'), PURCHASE_ORDER_APPROVE)).toBe(true);
    expect(can(organizationRole('PROCUREMENT'), PURCHASE_ORDER_APPROVE)).toBe(false);
    expect(can(organizationRole('IT_MANAGER'), PURCHASE_ORDER_APPROVE)).toBe(false);
  });
});
