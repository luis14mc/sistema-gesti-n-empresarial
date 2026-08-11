import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type LoadingStateProps = {
  label?: string;
  rows?: number;
  compact?: boolean;
  className?: string;
};

export function LoadingState({ label = 'Cargando información…', rows = 3, compact = false, className }: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" className={cn('flex flex-col gap-3', compact ? 'py-4' : 'py-8', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} className={cn('w-full', compact ? 'h-8' : 'h-12')} />)}
    </div>
  );
}
