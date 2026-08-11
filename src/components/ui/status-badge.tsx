import type { ComponentProps } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'info' | 'destructive';

const toneClasses: Record<StatusTone, string> = {
  neutral: 'border-border bg-muted text-muted-foreground',
  success: 'border-success/25 bg-success/15 text-success',
  warning: 'border-warning/30 bg-warning/20 text-warning-foreground',
  info: 'border-info/25 bg-info/15 text-info',
  destructive: 'border-destructive/25 bg-destructive/15 text-destructive',
};

export type StatusBadgeProps = Omit<ComponentProps<typeof Badge>, 'variant'> & {
  tone?: StatusTone;
};

export function StatusBadge({ tone = 'neutral', className, ...props }: StatusBadgeProps) {
  return <Badge variant="outline" className={cn(toneClasses[tone], className)} {...props} />;
}
