import { Badge } from '@/components/ui/badge';
import type { CompraDocumentoEstado } from '@/lib/compras/document-metadata';

const LABELS: Record<CompraDocumentoEstado, string> = {
  generado: 'Documento generado',
  pendiente: 'Documento pendiente',
  error: 'Error al generar',
};

const VARIANTS: Record<CompraDocumentoEstado, 'default' | 'secondary' | 'destructive'> = {
  generado: 'default',
  pendiente: 'secondary',
  error: 'destructive',
};

export function CompraDocumentoBadge({ estado }: { estado: CompraDocumentoEstado }) {
  return <Badge variant={VARIANTS[estado]}>{LABELS[estado]}</Badge>;
}
