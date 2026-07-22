import { Badge } from '@/components/ui/badge';
import { OFICIO_STATUS_LABELS, type OficioStatus } from '@/types';

const VARIANTS: Partial<Record<OficioStatus, 'default' | 'secondary' | 'destructive' | 'outline'>> = {
  DRAFT: 'secondary',
  SENT: 'outline',
  RECEIVED: 'default',
  IN_PROCESS: 'default',
  COMPLETED: 'default',
  ARCHIVED: 'outline',
};

export function OficioStatusBadge({ status }: { status: OficioStatus }) {
  return (
    <Badge variant={VARIANTS[status] ?? 'secondary'} className="font-normal">
      {OFICIO_STATUS_LABELS[status]}
    </Badge>
  );
}
