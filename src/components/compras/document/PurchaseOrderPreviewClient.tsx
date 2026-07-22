'use client';

import {
  PurchaseOrderDocument,
  type PurchaseOrderDocumentProps,
} from './PurchaseOrderDocument';

export function PurchaseOrderPreviewClient(props: PurchaseOrderDocumentProps) {
  return (
    <div className="overflow-auto rounded-lg bg-muted p-4 font-[Aptos,'Segoe_UI',sans-serif]">
      <div className="mx-auto min-h-[1056px] w-[816px] bg-white px-[45px] py-[45px] shadow-lg">
        <PurchaseOrderDocument {...props} />
      </div>
    </div>
  );
}
