'use client';

// ============================================
// SETTINGS PAGE — Configuración
// ============================================

import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { Settings, Palette, Bell, Shield } from 'lucide-react';

export default function SettingsPage() {
    const { user } = useAuth();

    return (
        <MainLayout>
            <div className="space-y-6 max-w-2xl">
                <PageHeader title="Ajustes" description="Configuración del sistema" />

                {/* Tema */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Palette className="h-5 w-5 text-muted-foreground" />
                            Apariencia
                        </CardTitle>
                        <CardDescription>Personaliza el aspecto visual</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-medium">Modo oscuro</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Alterna entre modo claro y oscuro
                                </p>
                            </div>
                            <ThemeToggle />
                        </div>
                    </CardContent>
                </Card>

                {/* Info usuario */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Shield className="h-5 w-5 text-muted-foreground" />
                            Tu cuenta
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Nombre</p>
                                <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Email</p>
                                <p className="text-sm font-medium">{user?.email}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Rol</p>
                                <p className="text-sm font-medium">{user?.role}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
