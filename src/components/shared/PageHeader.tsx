'use client';

// ============================================
// PAGE HEADER — Encabezado reutilizable
// ============================================

import { type ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    description?: string;
    children?: ReactNode; // Botones de acción
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
    return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight font-heading truncate">
                    {title}
                </h1>
                {description && (
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                )}
            </div>
            {children && (
                <div className="flex items-center gap-2 shrink-0">{children}</div>
            )}
        </div>
    );
}
