import type { CSSProperties } from 'react';

export type DisposalDocumentData = {
  folio: string;
  statusLabel: string;
  institutionName: string;
  inventoryCode: string;
  serialNumber: string;
  equipmentDescription: string;
  department: string;
  custodianName?: string | null;
  purchaseDate: string;
  purchasePrice: string;
  estimatedRepairCost: string;
  estimatedReplacementPrice: string;
  physicalCondition: string;
  functionalCondition: string;
  securitySupportStatus: string;
  technicalNotes?: string | null;
  evaluationScore: number;
  disposalResult: string;
  rationales: string[];
  signatureTitle: string;
  footerText?: string | null;
};

export function DisposalDocument({ data, draft = false }: { data: DisposalDocumentData; draft?: boolean }) {
  const style = { '--document-primary': '#252A58', '--document-accent': '#25A966' } as CSSProperties;
  return (
    <article className="disposal-document" style={style}>
      <style dangerouslySetInnerHTML={{ __html: `
        *{box-sizing:border-box}.disposal-document{position:relative;background:#fff;color:#172033;font:11px/1.4 Aptos,"Segoe UI",sans-serif}
        .dd-watermark{position:absolute;inset:38% 0 auto;transform:rotate(-28deg);color:rgba(37,42,88,.08);font-size:64px;font-weight:700;letter-spacing:.14em;text-align:center}
        .dd-content{position:relative}.dd-header{display:grid;grid-template-columns:1fr 260px;gap:20px;align-items:end;border-bottom:3px solid var(--document-primary);padding-bottom:12px}
        h1{margin:0;color:var(--document-primary);font-size:18px}.dd-id{text-align:right}.dd-title{font-size:15px;font-weight:700}.dd-folio{font-size:13px;font-weight:700}.dd-status{color:var(--document-accent);font-weight:700;letter-spacing:.1em}
        h2{margin:14px 0 7px;padding:5px 8px;background:var(--document-primary);border-left:5px solid var(--document-accent);color:#fff;font-size:10px;text-transform:uppercase}
        .dd-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px 22px;padding:2px 8px}.dd-field strong{color:#445064}
        table{width:100%;border-collapse:collapse}th,td{padding:6px;border:1px solid #bcc6d3;text-align:left}th{background:#eef2f7}.dd-score{font-size:18px;font-weight:700;color:var(--document-primary)}
        .dd-notes{min-height:44px;white-space:pre-wrap}.dd-signature{width:380px;min-height:220px;margin:26px auto 0;padding:18px 22px;border:1px solid #334155;break-inside:avoid}.dd-signature-title{text-align:center;font-weight:700}.dd-signature-space{height:70px}.dd-line{margin:0 0 13px}.dd-stamp{text-align:center;text-transform:uppercase}.dd-footer{margin-top:18px;padding-top:7px;border-top:1px solid #ccd4df;color:#667386;font-size:8px;text-align:center}
      ` }} />
      {draft ? <div className="dd-watermark">BORRADOR</div> : null}
      <div className="dd-content">
        <header className="dd-header"><div><h1>{data.institutionName}</h1></div><div className="dd-id"><div className="dd-title">DICTAMEN TÉCNICO DE BAJA</div><div className="dd-folio">{data.folio}</div><div className="dd-status">{data.statusLabel}</div></div></header>
        <h2>Datos del activo</h2>
        <div className="dd-grid"><div className="dd-field"><strong>Inventario:</strong> {data.inventoryCode}</div><div className="dd-field"><strong>Serie:</strong> {data.serialNumber}</div><div className="dd-field"><strong>Equipo:</strong> {data.equipmentDescription}</div><div className="dd-field"><strong>Departamento:</strong> {data.department}</div><div className="dd-field"><strong>Custodio:</strong> {data.custodianName || 'Sin asignación'}</div><div className="dd-field"><strong>Fecha de compra:</strong> {data.purchaseDate}</div></div>
        <h2>Evaluación técnica</h2>
        <table><tbody><tr><th>Condición física</th><td>{data.physicalCondition}</td><th>Condición funcional</th><td>{data.functionalCondition}</td></tr><tr><th>Soporte y seguridad</th><td>{data.securitySupportStatus}</td><th>Puntuación</th><td className="dd-score">{data.evaluationScore}/100</td></tr><tr><th>Precio de compra</th><td>{data.purchasePrice}</td><th>Costo de reparación</th><td>{data.estimatedRepairCost}</td></tr><tr><th>Reemplazo estimado</th><td>{data.estimatedReplacementPrice}</td><th>Resultado</th><td>{data.disposalResult}</td></tr></tbody></table>
        <h2>Fundamentos del dictamen</h2><ul>{data.rationales.map((rationale) => <li key={rationale}>{rationale}</li>)}</ul>
        <h2>Notas técnicas</h2><div className="dd-notes">{data.technicalNotes || 'Sin observaciones adicionales.'}</div>
        <section className="dd-signature"><p className="dd-signature-title">{data.signatureTitle}</p><div className="dd-signature-space" /><p className="dd-line">Firma: ____________________________________</p><p className="dd-line">Nombre: ___________________________________</p><p className="dd-line">Fecha: ____________________________________</p><p className="dd-stamp">Espacio para sello institucional</p></section>
        <footer className="dd-footer">{data.footerText || data.institutionName} · {data.folio}</footer>
      </div>
    </article>
  );
}
