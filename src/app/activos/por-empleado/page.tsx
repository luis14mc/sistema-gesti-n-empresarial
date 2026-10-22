'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDebounce } from '@/hooks/useDebounce';
import { useEmployees } from '@/hooks/useEmployees';
import { apiHelpers } from '@/utils/api';
import { useAuth } from '@/hooks/useAuth';
import { canAccess } from '@/platform/security/session-module-access';
import type { Role } from '@/types';

type EmployeeAssetsResponse = {
  employee: { id: string; fullName: string; employeeCode: string; isActive: boolean };
  equipos: {
    assignmentId: string;
    equipmentId: string;
    codigo: string;
    nombre: string;
    asignadoDesde: string;
    actaEntregaUrl: string | null;
  }[];
  licencias: {
    assignmentId: string;
    subscriptionId: string;
    seatId: string;
    producto: string;
    plan: string;
    cuenta: string | null;
    asignadoDesde: string;
  }[];
};

export default function EmployeeAssetsPage() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const role = (user?.role ?? 'USER') as Role;
  const showLicenses = canAccess(role, 'software-licenses', 'read');

  const initialEmployeeId = searchParams.get('employeeId') ?? '';
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId);
  const [assets, setAssets] = useState<EmployeeAssetsResponse | null>(null);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetsError, setAssetsError] = useState<string | null>(null);

  const { employees, isLoading: loadingEmployees } = useEmployees({
    search: debouncedSearch.trim() || undefined,
    page: 1,
    pageSize: 8,
    isActive: undefined,
  });

  useEffect(() => {
    if (initialEmployeeId) setSelectedEmployeeId(initialEmployeeId);
  }, [initialEmployeeId]);

  useEffect(() => {
    if (!selectedEmployeeId) {
      setAssets(null);
      return;
    }
    let cancelled = false;
    setLoadingAssets(true);
    setAssetsError(null);
    void apiHelpers
      .get<EmployeeAssetsResponse>(`/api/employees/${selectedEmployeeId}/assets`)
      .then((response) => {
        if (!cancelled) setAssets(response.data);
      })
      .catch(() => {
        if (!cancelled) {
          setAssets(null);
          setAssetsError('No se pudieron cargar los activos del empleado.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingAssets(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedEmployeeId]);

  const selectedLabel = useMemo(() => {
    if (assets?.employee) return `${assets.employee.fullName} (${assets.employee.employeeCode})`;
    const match = employees.find((e) => e.id === selectedEmployeeId);
    return match ? `${match.fullName} (${match.employeeCode})` : null;
  }, [assets, employees, selectedEmployeeId]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Activos por empleado"
          description="Vista de solo lectura de equipos y licencias con asignación activa."
          breadcrumbs={[
            { label: 'Activos', href: '/activos/equipos' },
            { label: 'Por empleado' },
          ]}
        />

        <div className="space-y-2 max-w-xl">
          <Label>Buscar empleado</Label>
          <Input
            placeholder="Nombre o código"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="rounded-lg border divide-y max-h-56 overflow-y-auto">
            {loadingEmployees ? (
              <p className="p-3 text-sm text-muted-foreground">Buscando…</p>
            ) : employees.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Sin resultados.</p>
            ) : (
              employees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/60 ${
                    selectedEmployeeId === employee.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => setSelectedEmployeeId(employee.id)}
                >
                  <span className="font-medium">{employee.fullName}</span>
                  <span className="text-muted-foreground"> · {employee.employeeCode}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {selectedEmployeeId ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {selectedLabel ?? 'Empleado seleccionado'}
            </p>
            {loadingAssets ? (
              <p className="text-sm text-muted-foreground">Cargando activos…</p>
            ) : assetsError ? (
              <p className="text-sm text-destructive">{assetsError}</p>
            ) : assets ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Equipos asignados</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {assets.equipos.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin equipos activos.</p>
                    ) : (
                      assets.equipos.map((item) => (
                        <div key={item.assignmentId} className="rounded-lg border p-3 text-sm space-y-1">
                          <Link
                            href={`/activos/equipos?id=${item.equipmentId}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {item.codigo}
                          </Link>
                          <p>{item.nombre}</p>
                          <p className="text-xs text-muted-foreground">
                            Desde {format(new Date(item.asignadoDesde), 'dd/MM/yyyy', { locale: es })}
                          </p>
                          {item.actaEntregaUrl ? (
                            <Button variant="link" className="h-auto p-0 text-xs" asChild>
                              <a href={item.actaEntregaUrl} target="_blank" rel="noreferrer">
                                Acta de entrega
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {showLicenses ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Licencias asignadas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {assets.licencias.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sin licencias activas.</p>
                      ) : (
                        assets.licencias.map((item) => (
                          <div key={item.assignmentId} className="rounded-lg border p-3 text-sm space-y-1">
                            <Link
                              href={`/activos/licencias/${item.subscriptionId}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {item.producto}
                            </Link>
                            <p className="text-muted-foreground">{item.plan}</p>
                            {item.cuenta ? <p>Cuenta: {item.cuenta}</p> : null}
                            <p className="text-xs text-muted-foreground">
                              Desde {format(new Date(item.asignadoDesde), 'dd/MM/yyyy', { locale: es })}
                            </p>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </MainLayout>
  );
}
