import type { EquipmentDisposal, Equipment, Organization } from '@prisma/client';
import { DisposalDocument, type DisposalDocumentData } from '../presentation/components/DisposalDocument';
import { renderHtmlToPdf } from '@/lib/compras/pdf-renderer';
import { getStorage } from '@/lib/storage';
import { prisma } from '@/lib/prisma';

type DisposalForPdf = EquipmentDisposal & { equipment: Pick<Equipment, 'inventoryCode' | 'status'> };

const money = (value: { toNumber(): number }) => `L ${value.toNumber().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function buildData(disposal: DisposalForPdf, organization: Organization, signatureTitle: string, footerText?: string | null): DisposalDocumentData {
  const evaluation = disposal.evaluationRationales as { rationales?: unknown } | null;
  const rationales = Array.isArray(evaluation?.rationales)
    ? evaluation.rationales.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    folio: disposal.folio,
    statusLabel: 'APROBADO',
    institutionName: organization.legalName ?? organization.name,
    inventoryCode: disposal.equipment.inventoryCode,
    serialNumber: disposal.serialNumber,
    equipmentDescription: `${disposal.brand} ${disposal.model}`,
    department: disposal.department,
    custodianName: disposal.custodianName,
    purchaseDate: disposal.purchaseDate.toLocaleDateString('es-HN'),
    purchasePrice: money(disposal.purchasePrice),
    estimatedRepairCost: money(disposal.estimatedRepairCost),
    estimatedReplacementPrice: money(disposal.estimatedReplacementPrice),
    physicalCondition: disposal.physicalCondition,
    functionalCondition: disposal.functionalCondition,
    securitySupportStatus: disposal.securitySupportStatus,
    technicalNotes: disposal.technicalNotes,
    evaluationScore: disposal.evaluationScore,
    disposalResult: disposal.disposalResult,
    rationales,
    signatureTitle,
    footerText,
  };
}

export async function generateAndStoreDisposalPdf(disposal: DisposalForPdf, requestId: string) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const [organization, policy] = await Promise.all([
    prisma.organization.findUnique({ where: { id: disposal.organizationId } }),
    prisma.disposalPolicy.findUnique({ where: { organizationId: disposal.organizationId } }),
  ]);
  if (!organization || !policy) throw new Error('ACTIVE_DISPOSAL_POLICY_NOT_FOUND');
  const data = buildData(disposal, organization, policy.signatureTitle, policy.footerText);
  let markup: string;
  try {
    markup = renderToStaticMarkup(<DisposalDocument data={data} draft={false} />);
  } catch (error) {
    throw new Error('DISPOSAL_RENDER_FAILED', { cause: error });
  }
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:#fff;font-family:Aptos,"Segoe UI",sans-serif}*{box-sizing:border-box}@page{size:Letter;margin:12mm}</style></head><body>${markup}</body></html>`;
  const buffer = await renderHtmlToPdf(html);
  if (!buffer.length) throw new Error('EMPTY_DISPOSAL_PDF');
  try {
    const stored = await getStorage().put({
      prefix: `organizations/${disposal.organizationId}/equipment-disposals/${disposal.id}/pdf`,
      originalName: `${disposal.folio}.pdf`,
      desiredName: `${disposal.folio}.pdf`,
      mimeType: 'application/pdf',
      size: buffer.length,
      buffer,
    });
    return {
      storageKey: stored.key,
      dataSnapshot: data,
      templateSnapshot: { organizationId: organization.id, signatureTitle: policy.signatureTitle, footerText: policy.footerText, requestId },
    };
  } catch (error) {
    throw new Error('DISPOSAL_PDF_STORAGE_FAILED', { cause: error });
  }
}
