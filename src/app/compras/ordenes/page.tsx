'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/shared/Pagination';
import { CompraStatusBadge } from '@/components/compras/CompraStatusBadge';
import { CompraOrdenGeneratedRowActions } from '@/components/compras/CompraOrdenGeneratedRowActions';
import { useCompraOrdenes } from '@/hooks/useCompraOrden';
import { useAuth } from '@/hooks/useAuth';
import {
  canCompraOrdenAction,
  useOrganizationPermissions,
} from '@/modules/purchases/presentation/purchase-order-client-permissions';
import { ORDER_STATUS_LABELS } from '@/modules/purchases/domain/purchase-order-constants';
import type { GeneratedOrdersStatusFilter } from '@/modules/purchases/domain/list-status-filter';
import type { PurchaseOrderStatus } from '@/types/compra-orden';
import { formatPurchaseDateTime, formatPurchaseMoney } from '@/components/compras/purchase-order-format-list';

const FILTER_LABELS: Record<GeneratedOrdersStatusFilter, string> = {
  active: 'Activas (generada / emitida)',
  closed: 'Cerradas',
  cancelled: 'Anuladas',
  all: 'Todas las generadas',
};

export default function ComprasOrdenesGeneradasPage() {
  const { user } = useAuth();
  const permissions = useOrganizationPermissions();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<GeneratedOrdersStatusFilter>('active');
  const { ordenes, totalPages, isLoading } = useCompraOrdenes({
    page,
    pageSize: 10,
    search: search || undefined,
    status: statusFilter,
  });

  if (!user) return null;
  const membershipRole = (user.membershipRole ?? user.role) as
    | import('@/platform/security/authorization/permissions').OrganizationRole
    | undefined;

  return (
    <MainLayout>
      <div className="font-[Aptos,'Segoe_UI',sans-serif]">
        <PageHeader
          title="Órdenes generadas"
          description="Órdenes con número asignado (generadas, emitidas, cerradas o anuladas)"
        >
          <Button asChild size="lg" variant="outline">
            <Link href="/compras/nueva">
              <Plus className="mr-2 h-5 w-5" />
              Nueva orden
            </Link>
          </Button>
        </PageHeader>
        <Card className="mb-4">
          <CardContent className="pt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <Input
              className="flex-1"
              placeholder="Buscar por número, referencia o proveedor…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as GeneratedOrdersStatusFilter);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[260px]" aria-label="Filtrar por estado">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FILTER_LABELS) as GeneratedOrdersStatusFilter[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {FILTER_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N.º de orden</TableHead>
                  <TableHead>Fecha de generación</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      Cargando…
                    </TableCell>
                  </TableRow>
                ) : ordenes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      No hay órdenes en este filtro
                    </TableCell>
                  </TableRow>
                ) : (
                  ordenes.map((order) => {
                    const status = (order.status ?? order.estado) as PurchaseOrderStatus;
                    const canViewPdf = canCompraOrdenAction(permissions, 'read', {
                      isCreator: order.createdById === user.id,
                      status,
                      membershipRole,
                    });
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          <Link href={`/compras/ordenes/${order.id}`} className="hover:underline">
                            {order.orderNumber ?? order.numeroOrden ?? '—'}
                          </Link>
                        </TableCell>
                        <TableCell>
                          {formatPurchaseDateTime(order.generatedAt ?? order.createdAt)}
                        </TableCell>
                        <TableCell>{order.supplierName ?? order.proveedorNombre}</TableCell>
                        <TableCell className="text-right">{formatPurchaseMoney(order.total)}</TableCell>
                        <TableCell>
                          <CompraStatusBadge
                            estado={status as string}
                            label={ORDER_STATUS_LABELS[status]}
                          />
                        </TableCell>
                        <TableCell>
                          <CompraOrdenGeneratedRowActions
                            orderId={order.id}
                            activePdfDocumentId={order.activeOrderPdfDocumentId}
                            canViewPdf={canViewPdf}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </MainLayout>
  );
}
