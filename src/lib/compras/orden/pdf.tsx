import type { CompraOrden, CompraOrdenItem } from '@prisma/client';
import { PurchaseOrderDocument } from '@/components/compras/document/PurchaseOrderDocument';
import { buildPreviewDataFromOrder } from './preview-data';
import type { PurchaseOrderTemplateConfig } from './template-config';
import { resolveInstitutionLogoDataUri } from '@/lib/compras/institution';

type OrderPdfData = Pick<
  CompraOrden,
  | 'orderNumber'
  | 'purchaseReference'
  | 'requestDate'
  | 'requiredDate'
  | 'requestedByName'
  | 'requesterJobTitle'
  | 'supplierName'
  | 'supplierRtn'
  | 'supplierPhone'
  | 'purchaseJustification'
  | 'subtotal'
  | 'discountType'
  | 'discountValue'
  | 'discount'
  | 'taxRate'
  | 'tax'
  | 'total'
  | 'status'
> & { items: CompraOrdenItem[] };

export async function buildPurchaseOrderHtml(
  order: OrderPdfData,
  format: PurchaseOrderTemplateConfig,
  _version = 1
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const logoSrc = format.logoUrl && format.logoUrl.trim().length > 0
    ? format.logoUrl.trim()
    : null;
  let resolvedLogo: string | null = null;
  if (logoSrc) {
    try {
      const candidate = await resolveInstitutionLogoDataUri(logoSrc);
      if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
        const response = await fetch(candidate, { signal: AbortSignal.timeout(5_000) });
        if (!response.ok) throw new Error(`Logo request failed with status ${response.status}`);
        const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
        const buffer = Buffer.from(await response.arrayBuffer());
        resolvedLogo = `data:${contentType};base64,${buffer.toString('base64')}`;
      } else {
        resolvedLogo = candidate;
      }
    } catch (error) {
      console.warn('[PURCHASE ORDER] Logo unavailable; continuing without it', {
        logoUrl: logoSrc,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const resolvedFormat = {
    ...format,
    logoUrl: resolvedLogo,
  };
  const document = buildPreviewDataFromOrder(order, resolvedFormat, {
    isDraft: order.status === 'DRAFT',
  });

  let markup: string;
  try {
    markup = renderToStaticMarkup(
      <PurchaseOrderDocument
        order={document}
        format={resolvedFormat}
        draft={document.isDraft}
      />
    );
  } catch (error) {
    throw new Error('PURCHASE_ORDER_RENDER_FAILED', { cause: error });
  }

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>html,body{margin:0;padding:0;background:#fff;font-family:Aptos,"Segoe UI",sans-serif}*{box-sizing:border-box}@page{size:Letter;margin:12mm}</style></head><body>${markup}</body></html>`;
}
