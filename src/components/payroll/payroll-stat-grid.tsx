import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PAYROLL_BRAND } from '@/components/payroll/payroll-chrome';

export type PayrollStatItem = {
  label: string;
  value: ReactNode;
  hint?: string;
};

export function PayrollStatGrid({
  items,
  className,
}: {
  items: PayrollStatItem[];
  className?: string;
}) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {items.map((item) => (
        <Card
          key={item.label}
          className="overflow-hidden border-border/60 bg-card/80 shadow-sm"
          style={{ borderLeftWidth: 4, borderLeftColor: PAYROLL_BRAND }}
        >
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{item.value}</div>
            {item.hint ? <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
