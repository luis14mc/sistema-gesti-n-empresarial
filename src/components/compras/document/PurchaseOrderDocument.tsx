import type { CSSProperties } from 'react';
import { UNIT_LABELS } from '@/lib/compras/orden/constants';
import type { PurchaseOrderPreviewData } from '@/lib/compras/orden/preview-data';
import type { PurchaseOrderTemplateConfig } from '@/lib/compras/orden/template-config';

export type PurchaseOrderDocumentProps = {
  order: PurchaseOrderPreviewData;
  format: PurchaseOrderTemplateConfig;
  draft?: boolean;
};

export const purchaseOrderDocumentCss = `
  @page { size: Letter; margin: 12mm 12mm 14mm; }
  * { box-sizing: border-box; }
  html, body, .purchase-order-document { margin: 0; background: white; color: #172033; font-family: Aptos, "Segoe UI", sans-serif; }
  .po-document { position: relative; width: 100%; min-height: 100%; padding: 0; background: white; font-family: Aptos, "Segoe UI", sans-serif; font-size: 11px; line-height: 1.35; }
  .po-watermark { position: absolute; inset: 31% 0 auto; z-index: 0; transform: rotate(-28deg); color: color-mix(in srgb, var(--po-primary) 9%, transparent); font-family: Aptos, "Segoe UI", sans-serif; font-size: 68px; font-weight: 700; letter-spacing: .16em; text-align: center; pointer-events: none; }
  .po-content { position: relative; z-index: 1; }
  .po-header { display: grid; grid-template-columns: 86px minmax(0,1fr) 205px; align-items: center; gap: 14px; padding-bottom: 11px; border-bottom: 3px solid var(--po-primary); }
  .po-logo { display: block; width: 76px; height: 64px; object-fit: contain; }
  .po-institution { text-align: center; }
  .po-institution-name { margin: 0 0 3px; color: var(--po-primary); font-size: 16px; font-weight: 700; letter-spacing: .025em; }
  .po-institution-meta { margin: 1px 0; color: #526072; font-size: 9px; }
  .po-document-id { text-align: right; }
  .po-document-title { margin: 0; color: var(--po-primary); font-size: 15px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .po-number { margin: 6px 0 0; font-size: 12px; font-weight: 700; }
  .po-status { margin: 3px 0 0; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
  .po-info { display: grid; grid-template-columns: repeat(4,1fr); border: 1px solid #cbd3df; border-top: 0; }
  .po-info-cell { min-height: 43px; padding: 6px 8px; border-right: 1px solid #dce2ea; }
  .po-info-cell:last-child { border-right: 0; }
  .po-label { display: block; margin-bottom: 2px; color: #657184; font-size: 8px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .po-section { margin-top: 11px; break-inside: avoid; }
  .po-section-title { margin: 0 0 6px; padding: 4px 8px; color: white; background: var(--po-primary); border-left: 5px solid var(--po-secondary); font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
  .po-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 20px; padding: 1px 8px; }
  .po-field strong { color: #3f4b5c; }
  .po-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .po-table th { padding: 5px; color: white; background: var(--po-primary); border: 1px solid var(--po-primary); font-size: 8px; font-weight: 700; text-transform: uppercase; }
  .po-table td { padding: 5px 6px; border: 1px solid #b8c2cf; vertical-align: top; }
  .po-table th:nth-child(1) { width: 7%; } .po-table th:nth-child(2) { width: 39%; } .po-table th:nth-child(3) { width: 13%; } .po-table th:nth-child(4) { width: 11%; } .po-table th:nth-child(5), .po-table th:nth-child(6) { width: 15%; }
  .po-center { text-align: center; } .po-right { text-align: right; }
  .po-totals { width: 285px; margin: 7px 0 0 auto; border-collapse: collapse; }
  .po-totals td { padding: 3px 8px; }
  .po-total-final td { padding-top: 6px; border-top: 2px solid var(--po-primary); color: var(--po-primary); font-size: 12px; font-weight: 700; }
  .po-justification { min-height: 36px; margin: 0; padding: 2px 8px; white-space: pre-wrap; }
  .po-note { margin: 6px 8px 0; color: #526072; font-style: italic; }
  .po-signature { width: 360px; min-height: 210px; margin: 24px auto 0; padding: 18px 20px; border: 1px solid #334155; break-inside: avoid; }
  .po-signature-title { margin: 0; color: var(--po-primary); font-size: 11px; font-weight: 700; text-align: center; text-transform: uppercase; }
  .po-signature-space { height: 62px; }
  .po-signature-line { margin: 0 0 12px; }
  .po-stamp { margin: 17px 0 0; font-size: 9px; text-align: center; text-transform: uppercase; }
  .po-footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid #ccd4df; color: #687587; font-size: 8px; text-align: center; }
  @media print { .po-document { min-height: auto; } }
`;

function money(value: number) {
  return `L ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('es-HN');
}

export function PurchaseOrderDocument({ order, format, draft = false }: PurchaseOrderDocumentProps) {
  const number = order.orderNumber || 'SE ASIGNARÁ AL GUARDAR';
  const status = draft ? 'BORRADOR' : order.statusLabel.toUpperCase();
  const meta = [
    format.showInstitutionAddress && format.institutionAddress,
    format.showInstitutionPhone && format.institutionPhone ? `Tel. ${format.institutionPhone}` : null,
    format.showInstitutionWebsite && format.institutionWebsite,
    format.showInstitutionRtn && format.institutionRtn ? `RTN ${format.institutionRtn}` : null,
  ].filter(Boolean) as string[];
  const style = {
    '--po-primary': format.primaryColor,
    '--po-secondary': format.secondaryColor,
  } as CSSProperties;

  return (
    <article className="po-document purchase-order-document" style={style}>
      <style dangerouslySetInnerHTML={{ __html: purchaseOrderDocumentCss }} />
      {draft ? <div className="po-watermark">BORRADOR</div> : null}
      <div className="po-content">
        <header className="po-header">
          <div>{format.logoUrl ? <img src={format.logoUrl} alt="Logo institucional" className="po-logo" /> : null}</div>
          <div className="po-institution">
            <h1 className="po-institution-name">{format.institutionName}</h1>
            {meta.map((line) => <p className="po-institution-meta" key={line}>{line}</p>)}
          </div>
          <div className="po-document-id">
            <p className="po-document-title">{format.documentTitle}</p>
            <p className="po-number">{number}</p>
            <p className="po-status">{status}</p>
          </div>
        </header>

        <div className="po-info">
          <div className="po-info-cell"><span className="po-label">Referencia</span>{format.showReference ? order.purchaseReference : '—'}</div>
          <div className="po-info-cell"><span className="po-label">Fecha de solicitud</span>{date(order.requestDate)}</div>
          <div className="po-info-cell"><span className="po-label">Fecha requerida</span>{format.showRequiredDate ? date(order.requiredDate) : '—'}</div>
          <div className="po-info-cell"><span className="po-label">Estado</span>{draft ? 'Borrador' : order.statusLabel}</div>
        </div>

        <section className="po-section">
          <h2 className="po-section-title">Información de la orden</h2>
          <div className="po-grid"><div className="po-field"><strong>Solicitado por:</strong> {order.requestedByName}</div><div className="po-field"><strong>Cargo:</strong> {order.requesterJobTitle}</div></div>
        </section>
        <section className="po-section">
          <h2 className="po-section-title">Proveedor</h2>
          <div className="po-grid"><div className="po-field"><strong>Nombre o razón social:</strong> {order.supplierName}</div><div className="po-field"><strong>RTN:</strong> {order.supplierRtn}</div><div className="po-field"><strong>Teléfono:</strong> {order.supplierPhone}</div></div>
        </section>
        <section className="po-section">
          <h2 className="po-section-title">Ítems y totales</h2>
          <table className="po-table"><thead><tr><th>Ítem</th><th>Descripción</th><th>Unidad</th><th>Cantidad</th><th>Precio unitario</th><th>Total</th></tr></thead><tbody>
            {order.items.map((item) => <tr key={item.itemNumber}><td className="po-center">{item.itemNumber}</td><td>{item.description}</td><td className="po-center">{UNIT_LABELS[item.unit]}</td><td className="po-right">{item.quantity}</td><td className="po-right">{money(item.unitPrice)}</td><td className="po-right">{money(item.total)}</td></tr>)}
          </tbody></table>
          <table className="po-totals"><tbody><tr><td>Subtotal</td><td className="po-right">{money(order.subtotal)}</td></tr><tr><td>Descuento</td><td className="po-right">{money(order.discount)}</td></tr><tr><td>Base gravable</td><td className="po-right">{money(order.taxableBase)}</td></tr><tr><td>ISV {order.taxRate}%</td><td className="po-right">{money(order.tax)}</td></tr><tr className="po-total-final"><td>TOTAL</td><td className="po-right">{money(order.total)}</td></tr></tbody></table>
        </section>
        <section className="po-section"><h2 className="po-section-title">Justificación de la compra</h2><p className="po-justification">{order.purchaseJustification}</p>{format.additionalNote ? <p className="po-note">{format.additionalNote}</p> : null}</section>
        <section className="po-signature"><p className="po-signature-title">{format.signatureTitle || 'ÁREA ADMINISTRATIVA'}</p><div className="po-signature-space" /><p className="po-signature-line">Firma: ____________________________________</p><p className="po-signature-line">Nombre: ___________________________________</p><p className="po-signature-line">Fecha: ____________________________________</p><p className="po-stamp">Espacio para sello</p></section>
        <footer className="po-footer">Consejo Nacional de Inversiones · Orden: {number} · Fecha de generación: {new Date().toLocaleDateString('es-HN')} · {draft ? 'Estado: Borrador · ' : ''}Página 1</footer>
      </div>
    </article>
  );
}
