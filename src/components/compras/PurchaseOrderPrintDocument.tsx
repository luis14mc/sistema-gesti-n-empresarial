'use client';

import { useEffect } from 'react';
import {
  PurchaseOrderDocument,
  type PurchaseOrderDocumentProps,
} from './document/PurchaseOrderDocument';

export function PurchaseOrderPrintDocument(props: PurchaseOrderDocumentProps & { autoPrint?: boolean }) {
  useEffect(() => {
    if (props.autoPrint) window.print();
  }, [props.autoPrint]);
  return <PurchaseOrderDocument order={props.order} format={props.format} draft={props.draft} />;
}
