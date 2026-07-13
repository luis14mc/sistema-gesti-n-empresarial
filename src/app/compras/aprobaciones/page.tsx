'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { CompraStatusBadge } from '@/components/compras/CompraStatusBadge';
import { useComprasSolicitudes } from '@/hooks/useCompras';
import { useAuth } from '@/hooks/useAuth';

const PENDIENTES = ['ENVIADA', 'AUTORIZADA'] as const;

export default function ComprasAprobacionesPage() {
  const { user } = useAuth();
  const { solicitudes, isLoading } = useComprasSolicitudes({ pageSize: 50 });

  if (!user) return null;

  const pendientes = solicitudes.filter((s) =>
    (PENDIENTES as readonly string[]).includes(s.estado)
  );

  return (
    <MainLayout>
      <PageHeader
        title="Autorización y aprobación"
        description="Solicitudes enviadas o autorizadas pendientes de acción"
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5}>Cargando...</TableCell></TableRow>
              ) : pendientes.length === 0 ? (
                <TableRow><TableCell colSpan={5}>No hay solicitudes pendientes.</TableCell></TableRow>
              ) : pendientes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{s.numero}</TableCell>
                  <TableCell>{s.proveedorNombre ?? '—'}</TableCell>
                  <TableCell>
                    {s.solicitadoPor
                      ? `${s.solicitadoPor.firstName} ${s.solicitadoPor.lastName}`
                      : '—'}
                  </TableCell>
                  <TableCell><CompraStatusBadge estado={s.estado} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/compras/${s.id}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
