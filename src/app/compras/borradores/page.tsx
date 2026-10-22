'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import { useCompraOrdenes } from '@/hooks/useCompraOrden';
import { useAuth } from '@/hooks/useAuth';
import {
  canCompraOrdenAction,
  useOrganizationPermissions,
} from '@/modules/purchases/presentation/purchase-order-client-permissions';
import { getPurchaseOrderApiErrorMessage } from '@/platform/api/api-error';
import Swal from '@/components/compras/purchase-order-swal';
import type { PurchaseOrderStatus } from '@/types/compra-orden';
import {
  draftProvisionalLabel,
  formatPurchaseDateTime,
  formatPurchaseMoney,
} from '@/components/compras/purchase-order-format-list';

export default function ComprasBorradoresPage() {
  const { user } = useAuth();
  const permissions = useOrganizationPermissions();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { ordenes, totalPages, isLoading, deleteOrden, isSaving } = useCompraOrdenes({
    page,
    pageSize: 10,
    search: search || undefined,
    status: 'DRAFT',
  });

  if (!user) return null;
  const membershipRole = (user.membershipRole ?? user.role) as
    | import('@/platform/security/authorization/permissions').OrganizationRole
    | undefined;

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
        <PageHeader title="Borradores" description="Órdenes de compra en elaboración (estado borrador)">
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
              placeholder="Buscar por referencia, proveedor o solicitante…"
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
                  <TableHead>N.º provisional</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Última modificación</TableHead>
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
                    <TableCell colSpan={6} className="py-12 text-center">
                      <p className="text-muted-foreground mb-4">No hay borradores</p>
                      <Button asChild>
                        <Link href="/compras/nueva">Nueva orden</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  ordenes.map((order) => {
                    const status = (order.status ?? order.estado) as PurchaseOrderStatus;
                    const canDelete = canCompraOrdenAction(permissions, 'delete', {
                      isCreator: order.createdById === user.id,
                      status,
                      membershipRole,
                    });
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{draftProvisionalLabel(order)}</TableCell>
                        <TableCell>{order.supplierName ?? order.proveedorNombre}</TableCell>
                        <TableCell>{order.requestedByName ?? order.solicitadoPorNombre}</TableCell>
                        <TableCell className="text-right">{formatPurchaseMoney(order.total)}</TableCell>
                        <TableCell>{formatPurchaseDateTime(order.updatedAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button asChild size="sm">
                              <Link href={`/compras/ordenes/${order.id}`}>Continuar editando</Link>
                            </Button>
                            {canDelete ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={isSaving}
                                onClick={() => void handleDeleteDraft(order.id)}
                                aria-label="Eliminar borrador"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Eliminar
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
