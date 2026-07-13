'use client';

import Link from 'next/link';
import { Plus, Eye } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/shared/Pagination';
import { CompraStatusBadge } from '@/components/compras/CompraStatusBadge';
import { useComprasSolicitudes } from '@/hooks/useCompras';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { COMPRA_PRIORIDAD_LABELS, COMPRA_TIPO_LABELS } from '@/lib/compras/constants';

export default function ComprasPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { solicitudes, totalPages, isLoading } = useComprasSolicitudes({
    page,
    pageSize: 10,
    search: search || undefined,
  });

  if (!user) return null;

  return (
    <MainLayout>
      <PageHeader
        title="Solicitudes y Órdenes de Compra"
        description="Ficha digital — Borrador → Autorización → Aprobación → Orden → Recepción"
      >
        <Button asChild>
          <Link href="/compras/nueva"><Plus className="h-4 w-4 mr-2" /> Nueva solicitud</Link>
        </Button>
      </PageHeader>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <Input
            placeholder="Buscar por número, proveedor o justificación..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8}>Cargando...</TableCell></TableRow>
              ) : solicitudes.length === 0 ? (
                <TableRow><TableCell colSpan={8}>No hay solicitudes registradas.</TableCell></TableRow>
              ) : solicitudes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.numero}</TableCell>
                  <TableCell>{s.proveedorNombre ?? '—'}</TableCell>
                  <TableCell>{new Date(s.fechaSolicitud).toLocaleDateString('es-HN')}</TableCell>
                  <TableCell>{COMPRA_TIPO_LABELS[s.tipoCompra]}</TableCell>
                  <TableCell>{COMPRA_PRIORIDAD_LABELS[s.prioridad]}</TableCell>
                  <TableCell><CompraStatusBadge estado={s.estado} /></TableCell>
                  <TableCell className="text-right">
                    L. {s.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                  </TableCell>
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

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </MainLayout>
  );
}
