'use client';

import Link from 'next/link';
import { Download, Eye, MoreHorizontal, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { printPdf } from '@/modules/purchases/infrastructure/purchase-order-print-pdf';
import { compraOrdenService } from '@/services/compra-orden.service';
import { sileo } from 'sileo';
import { useState } from 'react';

type Props = {
  orderId: string;
  activePdfDocumentId?: string | null;
  canViewPdf: boolean;
  detailHref?: string;
};

export function CompraOrdenGeneratedRowActions({
  orderId,
  activePdfDocumentId,
  canViewPdf,
  detailHref = `/compras/ordenes/${orderId}`,
}: Props) {
  const [printing, setPrinting] = useState(false);
  const pdfId = activePdfDocumentId ?? null;
  const showPdfActions = Boolean(pdfId && canViewPdf);
  const downloadUrl =
    pdfId && canViewPdf ? compraOrdenService.getDocumentDownloadUrl(orderId, pdfId) : null;

  const handlePrint = async () => {
    if (!pdfId) return;
    setPrinting(true);
    try {
      const url = `${compraOrdenService.getDocumentViewUrl(orderId, pdfId)}?purpose=print`;
      await printPdf(url);
    } catch {
      sileo.error({
        title: 'No se pudo imprimir',
        description: 'Verifique su conexión o descargue el PDF desde el detalle.',
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="hidden sm:flex justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" asChild>
              <Link href={detailHref} aria-label="Ver" data-testid="view-purchase-order">
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver</TooltipContent>
        </Tooltip>
        {showPdfActions && downloadUrl ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="h-8 w-8" asChild>
                <a href={downloadUrl} download aria-label="Descargar PDF" data-testid="download-purchase-order-pdf">
                  <Download className="h-4 w-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Descargar PDF</TooltipContent>
          </Tooltip>
        ) : null}
        {showPdfActions ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={printing}
                aria-label="Imprimir"
                data-testid="print-purchase-order-pdf-row"
                onClick={() => void handlePrint()}
              >
                <Printer className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Imprimir</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="sm:hidden flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Acciones">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={detailHref}>Ver</Link>
            </DropdownMenuItem>
            {showPdfActions && downloadUrl ? (
              <DropdownMenuItem asChild>
                <a href={downloadUrl} download data-testid="download-purchase-order-pdf-mobile">
                  Descargar PDF
                </a>
              </DropdownMenuItem>
            ) : null}
            {showPdfActions ? (
              <DropdownMenuItem
                disabled={printing}
                onSelect={(event) => {
                  event.preventDefault();
                  void handlePrint();
                }}
              >
                Imprimir
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  );
}
