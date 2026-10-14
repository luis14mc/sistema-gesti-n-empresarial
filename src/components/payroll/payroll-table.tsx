'use client';

import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { MoneyLabel } from '@/components/payroll/money-label';

export type PayrollTableColumn<T> = {
  id: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  money?: boolean;
  className?: string;
  cell: (row: T) => ReactNode;
};

export function PayrollTable<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'Sin registros.',
  isLoading,
}: {
  columns: PayrollTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  isLoading?: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((col) => (
            <TableHead
              key={col.id}
              className={cn(
                'h-9 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground',
                col.align === 'right' && 'text-right',
                col.align === 'center' && 'text-center',
                col.className,
              )}
            >
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
              Cargando…
            </TableCell>
          </TableRow>
        ) : null}
        {!isLoading && rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : null}
        {!isLoading
          ? rows.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((col) => (
                  <TableCell
                    key={col.id}
                    className={cn(
                      col.align === 'right' && 'text-right tabular-nums',
                      col.align === 'center' && 'text-center',
                      col.className,
                    )}
                  >
                    {col.money ? (
                      <PayrollMoneyCell amount={col.cell(row) as number | null | undefined} />
                    ) : (
                      col.cell(row)
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))
          : null}
      </TableBody>
    </Table>
  );
}

export function PayrollMoneyCell({ amount }: { amount: number | null | undefined }) {
  if (amount == null || Number.isNaN(amount)) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <MoneyLabel amount={amount} />;
}
