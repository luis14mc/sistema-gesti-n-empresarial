import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ErrorStateProps = {
  title?: string;
  message?: string;
  requestId?: string;
  onRetry?: () => void;
  className?: string;
};

export function ErrorState({ title = 'No pudimos cargar la información', message = 'Intente nuevamente.', requestId, onRetry, className }: ErrorStateProps) {
  return (
    <Alert variant="destructive" className={cn('items-start', className)}>
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {requestId ? <p className="font-mono text-xs">Referencia: {requestId}</p> : null}
        {onRetry ? <Button type="button" variant="outline" size="sm" onClick={onRetry}>Reintentar</Button> : null}
      </AlertDescription>
    </Alert>
  );
}
