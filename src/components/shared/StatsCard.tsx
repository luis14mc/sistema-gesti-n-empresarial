'use client';

// ============================================
// STATS CARD — Tarjeta de estadística
// ============================================

import { type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: LucideIcon;
    trend?: { value: number; label: string };
    variant?: 'default' | 'primary' | 'secondary' | 'accent';
}

const variantStyles = {
    default: 'bg-card',
    primary: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    accent: 'bg-accent text-accent-foreground',
};

const iconStyles = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary-foreground/20 text-primary-foreground',
    secondary: 'bg-secondary-foreground/10 text-secondary-foreground',
    accent: 'bg-accent-foreground/10 text-accent-foreground',
};

export function StatsCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    variant = 'default',
}: StatsCardProps) {
    return (
        <Card className={cn(
            'transition-all hover:shadow-md',
            variantStyles[variant]
        )}>
            <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <p className={cn(
                            'text-xs font-medium uppercase tracking-wide',
                            variant === 'default' ? 'text-muted-foreground' : 'opacity-80'
                        )}>
                            {title}
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold mt-1 font-heading">
                            {value}
                        </p>
                        {subtitle && (
                            <p className={cn(
                                'text-xs mt-1',
                                variant === 'default' ? 'text-muted-foreground' : 'opacity-70'
                            )}>
                                {subtitle}
                            </p>
                        )}
                        {trend && (
                            <p className={cn(
                                'text-xs mt-2 font-medium',
                                trend.value >= 0 ? 'text-green-500' : 'text-red-500'
                            )}>
                                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
                            </p>
                        )}
                    </div>
                    <div className={cn(
                        'h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0',
                        iconStyles[variant]
                    )}>
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
