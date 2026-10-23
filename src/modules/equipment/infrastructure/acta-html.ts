import { CNI_PAYSLIP_LOGO_DATA_URI } from '@/modules/payroll/infrastructure/cni-logo';
import { formatActaHeaderDate, formatActaSignatureDate } from '@/modules/equipment/domain/acta-dates';
import {
  ACTA_ASSIGNMENT_ACCEPTANCE,
  ACTA_ASSIGNMENT_INTRO_BOLD,
  ACTA_ASSIGNMENT_INTRO_REST,
  ACTA_ASSIGNMENT_SUBJECT,
  ACTA_CONFIDENTIALITY_NOTE,
  ACTA_DISCHARGE_CONFIDENTIALITY,
  ACTA_DISCHARGE_COORDINATION,
  ACTA_DISCHARGE_DECLARATION,
  ACTA_DISCHARGE_INVENTORY_INTRO,
  ACTA_DISCHARGE_INTRO,
  ACTA_DISCHARGE_SIGN_CLOSING,
  ACTA_DISCHARGE_SUBTITLE,
  ACTA_DISCHARGE_THANKS,
  ACTA_DISCHARGE_TITLE,
  ACTA_FOOTER_ADDRESS,
  ACTA_FOOTER_PHONE_WEB,
  ACTA_HEADER_CONFIDENTIAL,
  ACTA_HEADER_ORG_TITLE,
  ACTA_RETURN_CLOSING,
  ACTA_RETURN_INTRO_1,
  ACTA_RETURN_PARAGRAPH_OTHER,
  ACTA_RETURN_PARAGRAPH_SUBSTITUTION,
  ACTA_RETURN_SUBJECT,
  ACTA_RETURN_VERIFICATION_BULLETS,
  ACTA_RETURN_VERIFICATION_INTRO,
  ACTA_RETURN_VERIFICATION_TITLE,
  ACTA_SECTION_EQUIPMENT_DETAILS,
  actaAssignmentConditions,
  isSubstitutionReturnReason,
} from '@/modules/equipment/domain/acta-texts';
import type {
  ActaEquipmentSnapshot,
  AssignmentActaViewModel,
  DischargeActaViewModel,
  ReturnActaViewModel,
} from '@/modules/equipment/domain/acta-view-models';

const CNI_BLUE = '#252A58';

export function escapeActaHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function dash(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : '—';
}

function inlineBoldMarkdown(text: string): string {
  return escapeActaHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function equipmentDetailRows(equipment: ActaEquipmentSnapshot): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['Marca / Modelo', `${dash(equipment.brand)} / ${dash(equipment.model)}`.replace('— / —', '—')],
    ['Número de Serie (S/N)', dash(equipment.serialNumber)],
    ['Número de Inventario', dash(equipment.inventoryNumber)],
    ['Memoria RAM', dash(equipment.ram)],
    ['Procesador', dash(equipment.processor)],
    ['Almacenamiento', dash(equipment.storage)],
    ['Sistema operativo', dash(equipment.operatingSystem)],
    ['Accesorios incluidos', dash(equipment.accessories)],
    ['Software instalado', dash(equipment.softwareInstalled)],
  ];
  if (equipment.returnCondition?.trim() || equipment.returnNotes?.trim()) {
    rows.push(['Estado al recibir', dash(equipment.returnCondition)]);
    rows.push(['Observaciones', dash(equipment.returnNotes)]);
  }
  return rows;
}

function equipmentTable(equipment: ActaEquipmentSnapshot): string {
  const rows = equipmentDetailRows(equipment)
    .map(
      ([label, value]) =>
        `<tr><th>${escapeActaHtml(label)}</th><td>${escapeActaHtml(value)}</td></tr>`,
    )
    .join('');
  return `<table class="detail-table">${rows}</table>`;
}

function signatureBlock(label: string, name: string, line2: string, line3: string): string {
  return `<div class="signature">
    <div class="sig-line"></div>
    <p class="sig-label">${escapeActaHtml(label)}</p>
    <p>${escapeActaHtml(name)}</p>
    <p class="sig-meta">${escapeActaHtml(line2)}</p>
    <p class="sig-meta">${escapeActaHtml(line3)}</p>
  </div>`;
}

const BASE_STYLES = `
  @page { size: Letter; margin: 14mm 12mm 18mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Carlito, Calibri, "Segoe UI", sans-serif; font-size: 11pt; color: #222; line-height: 1.45; }
  .page { position: relative; min-height: 100%; padding-bottom: 28px; }
  header.acta-header { position: relative; margin-bottom: 16px; min-height: 72px; }
  header.acta-header img.logo { position: absolute; top: 0; right: 0; height: 56px; width: auto; }
  header.acta-header .center { text-align: center; padding: 0 80px 0 0; }
  header.acta-header h1 { margin: 0; font-size: 13pt; color: ${CNI_BLUE}; font-weight: 700; }
  header.acta-header p.conf { margin: 6px 0 0; font-size: 10pt; font-weight: 600; }
  .doc-date { text-align: right; margin: 8px 0 16px; font-size: 10.5pt; }
  .memo-line { margin: 6px 0; }
  h2.section { color: ${CNI_BLUE}; font-size: 12pt; margin: 18px 0 8px; font-weight: 700; }
  table.detail-table { width: 100%; border-collapse: collapse; margin: 8px 0 12px; }
  table.detail-table th, table.detail-table td { border: 1px solid #bbb; padding: 6px 8px; text-align: left; vertical-align: top; }
  table.detail-table th { width: 38%; background: #f7f8fc; font-weight: 600; }
  ol.conditions { margin: 8px 0 16px 20px; padding: 0; }
  ol.conditions li { margin-bottom: 6px; }
  ul.bullets { margin: 8px 0 16px 20px; }
  p { margin: 0 0 10px; }
  .signatures { display: flex; gap: 24px; margin-top: 20px; }
  .signatures .signature { flex: 1; }
  .sig-line { border-bottom: 1px solid #333; height: 28px; margin-bottom: 6px; }
  .sig-label { font-weight: 600; margin: 0 0 4px; }
  .sig-meta { margin: 0 0 2px; font-size: 10pt; color: #444; }
  .note { margin-top: 18px; font-size: 9.5pt; color: #444; border-top: 1px solid #ddd; padding-top: 10px; }
  footer.acta-footer {
    position: fixed; left: 12mm; right: 12mm; bottom: 8mm;
    display: flex; justify-content: space-between; font-size: 8.5pt; color: #5a6a8a;
  }
  h1.discharge-title { text-align: center; color: ${CNI_BLUE}; font-size: 14pt; margin: 0; }
  p.discharge-sub { text-align: center; font-style: italic; margin: 6px 0 16px; }
  table.inventory { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 10pt; }
  table.inventory th { background: ${CNI_BLUE}; color: #fff; padding: 6px; border: 1px solid ${CNI_BLUE}; }
  table.inventory td { border: 1px solid #bbb; padding: 5px 6px; vertical-align: top; }
  .data-block { margin: 12px 0 16px; }
  .data-block p { margin: 4px 0; }
`;

function actaShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeActaHtml(title)}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="page">
    <header class="acta-header">
      <img class="logo" src="${CNI_PAYSLIP_LOGO_DATA_URI}" alt="CNI" />
      <div class="center">
        <h1>${escapeActaHtml(ACTA_HEADER_ORG_TITLE)}</h1>
        <p class="conf">${escapeActaHtml(ACTA_HEADER_CONFIDENTIAL)}</p>
      </div>
    </header>
    ${body}
    <p class="note">${escapeActaHtml(ACTA_CONFIDENTIALITY_NOTE)}</p>
  </div>
  <footer class="acta-footer">
    <span>${escapeActaHtml(ACTA_FOOTER_ADDRESS)}</span>
    <span>${escapeActaHtml(ACTA_FOOTER_PHONE_WEB)}</span>
  </footer>
</body>
</html>`;
}

function memoHeader(recipient: string, recipientDept: string, deliverer: string, delivererDept: string, subject: string, date: Date): string {
  return `
    <p class="doc-date">${escapeActaHtml(formatActaHeaderDate(date))}</p>
    <p class="memo-line"><strong>Para:</strong> ${escapeActaHtml(recipient)} — ${escapeActaHtml(recipientDept)}</p>
    <p class="memo-line"><strong>De:</strong> ${escapeActaHtml(deliverer)} — ${escapeActaHtml(delivererDept)}</p>
    <p class="memo-line"><strong>Asunto:</strong> ${escapeActaHtml(subject)}</p>
  `;
}

export function buildAssignmentActaHtml(model: AssignmentActaViewModel): string {
  const conditions = actaAssignmentConditions(model.equipmentDeliveryState);
  const conditionsHtml = conditions
    .map((c, i) => `<li value="${i + 1}">${escapeActaHtml(c)}</li>`)
    .join('');

  const body = `
    ${memoHeader(
      model.recipient.name,
      model.recipient.department,
      model.deliverer.name,
      model.deliverer.department,
      ACTA_ASSIGNMENT_SUBJECT,
      model.documentDate,
    )}
    <p><strong>${escapeActaHtml(ACTA_ASSIGNMENT_INTRO_BOLD)}</strong>${escapeActaHtml(ACTA_ASSIGNMENT_INTRO_REST)}</p>
    <h2 class="section">${escapeActaHtml(ACTA_SECTION_EQUIPMENT_DETAILS)}</h2>
    ${equipmentTable(model.equipment)}
    <h2 class="section">${escapeActaHtml('Condiciones de Entrega')}</h2>
    <ol class="conditions">${conditionsHtml}</ol>
    <h2 class="section">Aceptación y firma</h2>
    <p>${escapeActaHtml(ACTA_ASSIGNMENT_ACCEPTANCE)}</p>
    <div class="signatures">
      ${signatureBlock(
        'Firma del receptor',
        model.recipient.name,
        `Cargo: ${model.recipient.position} – ${model.recipient.department}`,
        '',
      )}
      ${signatureBlock(
        'Firma del responsable de entrega',
        model.deliverer.name,
        `Cargo: ${model.deliverer.position} - ${model.deliverer.department}`,
        '',
      )}
    </div>
    <p>${escapeActaHtml(formatActaSignatureDate(model.documentDate))}</p>
  `;
  return actaShell('Acta de asignación CNI', body);
}

export function buildReturnActaHtml(model: ReturnActaViewModel): string {
  const intro1 = ACTA_RETURN_INTRO_1.replace('{empleado}', model.recipient.name).replace(
    '{departamento}',
    model.recipient.department,
  );
  const reason = (model.returnReason ?? '').trim() || 'No especificado';
  const paragraph2 = isSubstitutionReturnReason(model.returnReason)
    ? ACTA_RETURN_PARAGRAPH_SUBSTITUTION
    : ACTA_RETURN_PARAGRAPH_OTHER.replace('{motivo}', reason);

  const bullets = ACTA_RETURN_VERIFICATION_BULLETS.map((b) => `<li>${escapeActaHtml(b)}</li>`).join('');

  const body = `
    ${memoHeader(
      model.recipient.name,
      model.recipient.department,
      model.deliverer.name,
      model.deliverer.department,
      ACTA_RETURN_SUBJECT,
      model.documentDate,
    )}
    <p>${escapeActaHtml(intro1)}</p>
    <p>${escapeActaHtml(paragraph2)}</p>
    <h2 class="section">${escapeActaHtml(ACTA_SECTION_EQUIPMENT_DETAILS)}</h2>
    ${equipmentTable(model.equipment)}
    <h2 class="section">${escapeActaHtml(ACTA_RETURN_VERIFICATION_TITLE)}</h2>
    <p>${escapeActaHtml(ACTA_RETURN_VERIFICATION_INTRO)}</p>
    <ul class="bullets">${bullets}</ul>
    <p>${escapeActaHtml(ACTA_RETURN_CLOSING)}</p>
    <div class="signatures">
      ${signatureBlock(
        'Firma de quien entrega',
        model.recipient.name,
        `Cargo: ${model.recipient.position} – ${model.recipient.department}`,
        '',
      )}
      ${signatureBlock(
        'Firma de quien recibe',
        model.deliverer.name,
        `Cargo: ${model.deliverer.position} - ${model.deliverer.department}`,
        '',
      )}
    </div>
    <p>${escapeActaHtml(formatActaSignatureDate(model.documentDate))}</p>
  `;
  return actaShell('Acta de devolución CNI', body);
}

function inventoryTable(
  title: string,
  columns: string[],
  rows: Array<Record<string, string>>,
): string {
  const head = `<tr><th>No.</th>${columns.map((c) => `<th>${escapeActaHtml(c)}</th>`).join('')}</tr>`;
  const bodyRows =
    rows.length === 0
      ? `<tr><td>1</td>${columns.map(() => '<td>Sin ítems</td>').join('')}</tr>`
      : rows
          .map((row, index) => {
            const cells = columns.map((col) => `<td>${escapeActaHtml(dash(row[col]))}</td>`).join('');
            return `<tr><td>${index + 1}</td>${cells}</tr>`;
          })
          .join('');
  return `<h2 class="section">${escapeActaHtml(title)}</h2><table class="inventory"><thead>${head}</thead><tbody>${bodyRows}</tbody></table>`;
}

export function buildDischargeActaHtml(model: DischargeActaViewModel): string {
  const body = `
    <h1 class="discharge-title">${escapeActaHtml(ACTA_DISCHARGE_TITLE)}</h1>
    <hr />
    <p class="discharge-sub">${escapeActaHtml(ACTA_DISCHARGE_SUBTITLE)}</p>
    <p class="doc-date">${escapeActaHtml(formatActaHeaderDate(model.documentDate))}</p>
    <div class="data-block">
      <p><strong>Fecha del acta:</strong> ${escapeActaHtml(formatActaHeaderDate(model.documentDate))}</p>
      <p><strong>Nombre del trabajador(a):</strong> ${escapeActaHtml(model.workerName)}</p>
      <p><strong>N.º de identidad:</strong> ${escapeActaHtml(model.workerDni)}</p>
      <p><strong>Cargo desempeñado:</strong> ${escapeActaHtml(model.workerPosition)}</p>
      <p><strong>Fecha efectiva de terminación:</strong> ${escapeActaHtml(formatActaHeaderDate(model.terminationDate))}</p>
    </div>
    <p>${inlineBoldMarkdown(ACTA_DISCHARGE_INTRO)}</p>
    <p>${escapeActaHtml(ACTA_DISCHARGE_INVENTORY_INTRO)}</p>
    ${inventoryTable('Equipo informático', ['Ítem', 'Marca/Modelo', 'Serie', 'Observaciones'], model.equipmentRows)}
    ${inventoryTable('Accesorios y periféricos', ['Ítem', 'Cantidad', 'Estado', 'Observaciones'], model.accessoryRows)}
    ${inventoryTable('Licencias de software', ['Software', 'N.º de licencia', 'Observaciones'], model.licenseRows)}
    ${inventoryTable('Contraseñas y accesos', ['Sistema/Acceso', 'Entregado/Revocado', 'Observaciones'], model.accessRows)}
    ${inventoryTable('Objetos varios', ['Ítem', 'Estado', 'Observaciones'], model.miscRows)}
    <p>${inlineBoldMarkdown(ACTA_DISCHARGE_CONFIDENTIALITY)}</p>
    <p>${inlineBoldMarkdown(ACTA_DISCHARGE_COORDINATION)}</p>
    <p>${inlineBoldMarkdown(ACTA_DISCHARGE_DECLARATION)}</p>
    <p>${escapeActaHtml(ACTA_DISCHARGE_THANKS)}</p>
    <p><strong>${escapeActaHtml(ACTA_DISCHARGE_SIGN_CLOSING)}</strong></p>
    <div class="signatures">
      ${signatureBlock('Firma del Trabajador(a)', model.workerName, `N.º de identidad: ${model.workerDni}`, formatActaSignatureDate(model.documentDate))}
      ${signatureBlock(
        'Recibido por — Informática y Tecnología',
        `Nombre: ${model.deliverer.name.toUpperCase()}`,
        `Cargo: ${model.deliverer.position}`,
        formatActaSignatureDate(model.documentDate),
      )}
    </div>
  `;
  return actaShell(ACTA_DISCHARGE_TITLE, body);
}
