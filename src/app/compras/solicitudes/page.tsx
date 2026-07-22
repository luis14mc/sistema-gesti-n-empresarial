'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Eye, Plus, Trash2 } from 'lucide-react';
import Swal from '@/lib/compras/orden/swal';
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
import { Pagination } from '@/components/shared/Pagination';
import { CompraStatusBadge } from '@/components/compras/CompraStatusBadge';
import { useCompraOrdenes } from '@/hooks/useCompraOrden';
import { useAuth } from '@/hooks/useAuth';
import { canOrdenAction } from '@/lib/compras/orden/permissions';
import { getPurchaseOrderApiErrorMessage } from '@/lib/api-error';
import { ORDER_STATUS_LABELS } from '@/lib/compras/orden/constants';
import type { Role } from '@/types';
import type { PurchaseOrderStatus } from '@/types/compra-orden';

function attachmentLabel(count?: number) {
  if (!count) return 'Sin adjuntos';
  return `${count} archivo${count === 1 ? '' : 's'}`;
}

export default function ComprasSolicitudesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { ordenes, totalPages, isLoading, deleteOrden, isSaving } = useCompraOrdenes({
    page,
    pageSize: 10,
    search: search || undefined,
  });

  if (!user) return null;

  const role = user.role as Role;

  const handleDeleteDraft = async (orderId: string) => {
    const confirmation = await Swal.fire({
      icon: 'warning',
      title: '¿Eliminar borrador?',
      text: 'Esta acción no se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
      focusCancel: true,
    });
    if (!confirmation.isConfirmed) return;

    try {
      await deleteOrden(orderId);
      await Swal.fire({ icon: 'success', title: 'Borrador eliminado', confirmButtonText: 'Aceptar' });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo eliminar',
        text: getPurchaseOrderApiErrorMessage(error, 'Ocurrió un error inesperado.'),
        confirmButtonText: 'Cerrar',
      });
    }
  };

  return (
    <MainLayout>
      <div className="font-[Aptos,'Segoe_UI',sans-serif]">
      <PageHeader title="Órdenes de Compra" description="Registro e historial de órdenes de compra">
        <Button asChild size="lg">
          <Link href="/compras/nueva">
            <Plus className="mr-2 h-5 w-5" />
            Nueva orden
          </Link>
        </Button>
      </PageHeader>
      <Card className="mb-4">
        <CardContent className="pt-6">
          <Input
            placeholder="Buscar…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Orden</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Adjuntos</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : ordenes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    Sin órdenes
                  </TableCell>
                </TableRow>
              ) : (
                ordenes.map((order) => {
                  const status = (order.status ?? order.estado) as PurchaseOrderStatus;
                  const isDraft = status === 'DRAFT';
                  const canDelete = isDraft && canOrdenAction(role, 'delete', {
                    isCreator: order.createdById === user.id,
                    status,
                  });
                  return (
                    <TableRow key={order.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/compras/ordenes/${order.id}`}>
                          {order.orderNumber ?? order.numeroOrden ?? 'Sin número'}
                        </Link>
                      </TableCell>
                      <TableCell>{order.purchaseReference ?? order.referenciaCompra}</TableCell>
                      <TableCell>{order.supplierName ?? order.proveedorNombre}</TableCell>
                      <TableCell>
                        <CompraStatusBadge
                          estado={status as string}
                          label={ORDER_STATUS_LABELS[status]}
                        />
                      </TableCell>
                      <TableCell>{attachmentLabel(order.documentsCount)}</TableCell>
                      <TableCell className="text-right">
                        L. {order.total.toLocaleString('es-HN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/compras/ordenes/${order.id}`} aria-label={isDraft ? 'Revisar borrador' : 'Ver orden'}>
                              <Eye className="mr-2 h-4 w-4" />
                              {isDraft ? 'Revisar borrador' : 'Ver orden'}
                            </Link>
                          </Button>
                          {canDelete ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={isSaving}
                              onClick={() => void handleDeleteDraft(order.id)}
                              aria-label="Eliminar borrador"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
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
