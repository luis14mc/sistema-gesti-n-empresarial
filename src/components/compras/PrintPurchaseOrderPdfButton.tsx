'use client';

import { useState, type ComponentProps } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { printPdf } from '@/modules/purchases/infrastructure/purchase-order-print-pdf';
import { compraOrdenService } from '@/services/compra-orden.service';
import { sileo } from 'sileo';

type PrintPurchaseOrderPdfButtonProps = {
  orderId: string;
  documentId: string;
  variant?: ComponentProps<typeof Button>['variant'];
  size?: ComponentProps<typeof Button>['size'];
  className?: string;
};

export function PrintPurchaseOrderPdfButton({
  orderId,
  documentId,
  variant = 'outline',
  size = 'default',
  className,
}: PrintPurchaseOrderPdfButtonProps) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const url = `${compraOrdenService.getDocumentViewUrl(orderId, documentId)}?purpose=print`;
      await printPdf(url);
    } catch {
      sileo.error({
        title: 'No se pudo imprimir',
        description: 'Verifique su conexión e intente de nuevo, o descargue el PDF.',
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={printing}
      data-testid="print-purchase-order-pdf"
      onClick={() => void handlePrint()}
    >
      {printing ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Printer className="mr-2 h-4 w-4" />
      )}
      {printing ? 'Preparando…' : 'Imprimir'}
    </Button>
  );
}
