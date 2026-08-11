import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  primaryAction,
  secondaryActions,
  children,
}: PageHeaderProps) {
  const legacyActions = children;

  return (
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumbs?.length ? (
          <nav aria-label="Migas de pan" className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
              {breadcrumbs.map((item, index) => (
                <li key={`${item.label}-${index}`} className="flex items-center gap-1">
                  {index > 0 ? <ChevronRight aria-hidden="true" className="size-4" /> : null}
                  {item.href ? <Link href={item.href} className="rounded-sm hover:text-foreground">{item.label}</Link> : <span aria-current="page">{item.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground sm:text-base">{description}</p> : null}
      </div>
      {primaryAction || secondaryActions || legacyActions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {secondaryActions}
          {legacyActions}
          {primaryAction}
        </div>
      ) : null}
    </header>
  );
}
