'use client';

// ============================================
// TIME ENTRIES PAGE — Marcado de reloj
// ============================================

import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { LogIn, LogOut, Coffee, Play, Clock, MapPin, ExternalLink } from 'lucide-react';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useAuth } from '@/hooks/useAuth';
import { sileo } from 'sileo';
import { swalConfirm } from '@/lib/swal';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { EntryType, TimeEntry } from '@/types';

// ============================================
// LIVE CLOCK
// ============================================

function LiveClock() {
    const [time, setTime] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="text-center">
            <p className="text-4xl sm:text-5xl font-bold font-heading tracking-tight tabular-nums">
                {format(time, 'HH:mm:ss')}
            </p>
            <p className="text-sm text-muted-foreground mt-1 capitalize">
                {format(time, "EEEE, dd 'de' MMMM", { locale: es })}
            </p>
        </div>
    );
}

// ============================================
// ENTRY TYPE CONFIG
// ============================================

const entryConfig: Record<EntryType, { label: string; icon: typeof LogIn; color: string }> = {
    CHECK_IN: { label: 'Entrada', icon: LogIn, color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
    CHECK_OUT: { label: 'Salida', icon: LogOut, color: 'bg-red-500/10 text-red-600 dark:text-red-400' },
    BREAK_START: { label: 'Inicio Break', icon: Coffee, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    BREAK_END: { label: 'Fin Break', icon: Play, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
};

// Smart next action
function getNextAction(entries: TimeEntry[]): EntryType {
    if (!entries.length) return 'CHECK_IN';
    const last = entries[0]?.type;
    switch (last) {
        case 'CHECK_IN': return 'BREAK_START';
        case 'BREAK_START': return 'BREAK_END';
        case 'BREAK_END': return 'CHECK_OUT';
        case 'CHECK_OUT': return 'CHECK_IN';
        default: return 'CHECK_IN';
    }
}

// ============================================
// PAGE
// ============================================

export default function TimeEntriesPage() {
    const { user } = useAuth();
    const { entries: timeEntries, isLoading, createEntry, isCreating } = useTimeEntries();

    const entries = timeEntries ?? [];
    const nextAction = getNextAction(entries);
    const config = entryConfig[nextAction];
    const NextIcon = config.icon;

    const handleAction = async () => {
        const result = await swalConfirm(
            `Registrar ${config.label}`,
            `¿Confirmas registrar ${config.label.toLowerCase()}?`,
            'Sí, registrar'
        );
        if (!result.isConfirmed) return;

        // Capturar geolocalización
        if (typeof window === 'undefined' || !window.navigator.geolocation) {
            sileo.error({ title: 'Error', description: 'Tu navegador no soporta geolocalización' });
            return;
        }

        sileo.info({ title: 'Obteniendo ubicación...', description: 'Por favor, permite el acceso.' });

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    await createEntry({
                        type: nextAction,
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        location: 'Ubicación capturada por GPS'
                    });
                    sileo.success({
                        title: `${config.label} registrada`,
                        description: `Se registró a las ${format(new Date(), 'HH:mm')}`,
                    });
                } catch {
                    sileo.error({ title: 'Error', description: 'No se pudo registrar en el servidor' });
                }
            },
            (error) => {
                const msg = error.code === 1 ? 'Debes permitir el acceso a la ubicación para registrar asistencia' : 'Error al obtener ubicación';
                sileo.error({ title: 'Acceso denegado', description: msg });
            }
        );
    };

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader title="Asistencia" description="Registro de entrada, salida y breaks" />

                {/* Clock + Action */}
                <Card>
                    <CardContent className="py-8 sm:py-12 flex flex-col items-center gap-6">
                        <LiveClock />
                        <Button
                            size="lg"
                            onClick={handleAction}
                            disabled={isCreating}
                            className="px-8"
                        >
                            <NextIcon className="h-5 w-5 mr-2" />
                            {isCreating ? 'Registrando...' : `Registrar ${config.label}`}
                        </Button>
                    </CardContent>
                </Card>

                {/* History */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-heading flex items-center gap-2">
                            <Clock className="h-5 w-5 text-muted-foreground" />
                            Historial Reciente
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="space-y-3">
                                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
                            </div>
                        ) : entries.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                No hay registros
                            </p>
                        ) : (
                            <div className="space-y-2">
                                {entries.slice(0, 10).map((entry: TimeEntry) => {
                                    const cfg = entryConfig[entry.type];
                                    const EntryIcon = cfg.icon;
                                    return (
                                        <div
                                            key={entry.id}
                                            className="flex items-center justify-between p-3 sm:p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${cfg.color}`}>
                                                    <EntryIcon className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{cfg.label}</p>
                                                    <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2">
                                                        <span>{format(new Date(entry.timestamp), "dd/MM/yyyy", { locale: es })}</span>
                                                        {entry.latitude && entry.longitude && (
                                                            <>
                                                                <span className="text-muted-foreground/30">•</span>
                                                                <button
                                                                    onClick={() => window.open(`https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`, '_blank')}
                                                                    className="flex items-center gap-1 text-[10px] font-medium bg-blue-500/5 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md hover:bg-blue-500/10 transition-colors"
                                                                    title="Ver en Google Maps"
                                                                >
                                                                    <MapPin className="h-3 w-3" />
                                                                    {entry.latitude.toFixed(4)}, {entry.longitude.toFixed(4)}
                                                                    <ExternalLink className="h-2.5 w-2.5 ml-0.5 opacity-50" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-sm font-semibold tabular-nums">
                                                {format(new Date(entry.timestamp), 'HH:mm')}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
