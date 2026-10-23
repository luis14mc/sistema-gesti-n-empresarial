import { renderHtmlToPdf } from '@/platform/pdf/html-to-pdf';
import { getStorage } from '@/platform/storage';
import { equipmentDocumentFileUrl } from '@/modules/equipment/infrastructure/equipment-document-access';
import {
  equipmentDocumentStoragePrefix,
  type EquipmentDocumentType,
} from '@/modules/equipment/domain/equipment-document-types';

export async function storeEquipmentActaPdf(params: {
  organizationId: string;
  tipo: EquipmentDocumentType;
  assignmentId: string;
  html: string;
  label: string;
}): Promise<{ storageKey: string; url: string }> {
  const buffer = await renderHtmlToPdf(params.html);
  if (!buffer.length) throw new Error('EMPTY_ACTA_PDF');

  const stored = await getStorage().put({
    prefix: `organizations/${params.organizationId}/${equipmentDocumentStoragePrefix(params.tipo)}`,
    originalName: `${params.label}.pdf`,
    desiredName: `${params.assignmentId}-${params.label}.pdf`,
    mimeType: 'application/pdf',
    size: buffer.length,
    buffer,
  });

  const url = stored.url.startsWith('/') ? stored.url : equipmentDocumentFileUrl(stored.key);
  return { storageKey: stored.key, url };
}

export async function storeDischargeActaPdf(params: {
  organizationId: string;
  employeeId: string;
  html: string;
}): Promise<{ storageKey: string; url: string }> {
  const buffer = await renderHtmlToPdf(params.html);
  if (!buffer.length) throw new Error('EMPTY_DISCHARGE_ACTA_PDF');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  const stored = await getStorage().put({
    prefix: `organizations/${params.organizationId}/equipment/actas-descargo`,
    originalName: `acta-descargo-${params.employeeId}.pdf`,
    desiredName: `${params.employeeId}-${stamp}.pdf`,
    mimeType: 'application/pdf',
    size: buffer.length,
    buffer,
  });

  const url = stored.url.startsWith('/') ? stored.url : equipmentDocumentFileUrl(stored.key);
  return { storageKey: stored.key, url };
}
