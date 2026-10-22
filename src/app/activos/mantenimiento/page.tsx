'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import MainLayout from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pagination } from '@/components/shared/Pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MaintenanceWorkflowActions } from '@/components/equipment/MaintenanceWorkflowActions';
import { AvailableEquipmentCombobox } from '@/components/equipment/AvailableEquipmentCombobox';
import { equipmentService } from '@/services/equipment.service';
import { useDebounce } from '@/hooks/useDebounce';
import { getApiErrorMessage } from '@/platform/api/api-error';
import { sileo } from 'sileo';
import type { Equipment } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programado',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

const TYPE_LABELS: Record<string, string> = {
  PREVENTIVE: 'Preventivo',
  CORRECTIVE: 'Correctivo',
  UPDATE: 'Actualización',
  INSPECTION: 'Inspección',
};

export default function MaintenanceListPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState({
    type: 'CORRECTIVE',
    description: '',
    scheduledDate: '',
  });

  const listQuery = useQuery({
    queryKey: ['maintenance', 'list', statusFilter, typeFilter, debouncedSearch, page],
    queryFn: async () => {
      const response = await equipmentService.listMaintenances({
        page,
        pageSize: 15,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        search: debouncedSearch.trim() || undefined,
      });
      return response.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      maintenanceId,
      status,
    }: {
      maintenanceId: string;
      status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
    }) => equipmentService.updateMaintenance(maintenanceId, { status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['maintenance'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      equipmentService.addMaintenance({
        equipmentId: selectedEquipment!.id,
        type: maintenanceForm.type as 'PREVENTIVE' | 'CORRECTIVE' | 'UPDATE' | 'INSPECTION',
        description: maintenanceForm.description,
        scheduledDate: maintenanceForm.scheduledDate || undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['maintenance'] });
      setRegisterOpen(false);
      setSelectedEquipment(null);
      setMaintenanceForm({ type: 'CORRECTIVE', description: '', scheduledDate: '' });
      sileo.success({ title: 'Mantenimiento registrado' });
    },
    onError: (error) => {
      sileo.error({ title: 'Error', description: getApiErrorMessage(error, 'No se pudo registrar') });
    },
  });

  const handleStatusChange = async (
    maintenanceId: string,
    nextStatus: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
  ) => {
    try {
      await updateMutation.mutateAsync({ maintenanceId, status: nextStatus });
      sileo.success({ title: 'Mantenimiento actualizado' });
    } catch (error) {
      sileo.error({
        title: 'Error',
        description: getApiErrorMessage(error, 'No se pudo actualizar el mantenimiento'),
      });
      throw error;
    }
  };

  const rows = listQuery.data?.maintenances ?? [];

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Mantenimiento de equipos"
          description="Seguimiento de mantenimientos programados y en curso."
          breadcrumbs={[
            { label: 'Activos', href: '/activos/equipos' },
            { label: 'Mantenimiento' },
          ]}
          primaryAction={
            <Button type="button" onClick={() => setRegisterOpen(true)}>
              Registrar mantenimiento
            </Button>
          }
        />

        <div className="grid gap-3 md:grid-cols-4">
          <div className="md:col-span-2 space-y-2">
            <Label>Buscar equipo</Label>
            <Input
              placeholder="Código, marca o modelo"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setPage(1);
                setStatusFilter(v);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setPage(1);
                setTypeFilter(v);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha programada</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No hay mantenimientos con estos filtros.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/activos/equipos?id=${row.equipment.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {row.equipment.inventoryCode}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {[row.equipment.brand, row.equipment.model].filter(Boolean).join(' ')}
                      </p>
                    </TableCell>
                    <TableCell>{TYPE_LABELS[row.type] ?? row.type}</TableCell>
                    <TableCell>{STATUS_LABELS[row.status] ?? row.status}</TableCell>
                    <TableCell>
                      {row.scheduledDate
                        ? format(new Date(row.scheduledDate), 'dd/MM/yyyy', { locale: es })
                        : '—'}
                    </TableCell>
                    <TableCell>{row.technician ?? '—'}</TableCell>
                    <TableCell className="max-w-xs truncate">{row.description}</TableCell>
                    <TableCell className="text-right">
                      <MaintenanceWorkflowActions
                        maintenanceId={row.id}
                        status={row.status}
                        disabled={updateMutation.isPending}
                        onStatusChange={handleStatusChange}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {listQuery.data && listQuery.data.totalPages > 1 ? (
          <Pagination
            currentPage={listQuery.data.page}
            totalPages={listQuery.data.totalPages}
            onPageChange={setPage}
          />
        ) : null}

        <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar mantenimiento</DialogTitle>
              <DialogDescription>
                Solo equipos disponibles (sin asignación activa). El equipo pasará a En mantenimiento.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!selectedEquipment) {
                  sileo.error({ title: 'Seleccione un equipo' });
                  return;
                }
                void createMutation.mutateAsync();
              }}
            >
              <AvailableEquipmentCombobox
                value={selectedEquipment}
                onChange={setSelectedEquipment}
                label="Equipo disponible"
              />
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={maintenanceForm.type}
                  onValueChange={(v) => setMaintenanceForm((f) => ({ ...f, type: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descripción *</Label>
                <Input
                  required
                  value={maintenanceForm.description}
                  onChange={(e) => setMaintenanceForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha programada</Label>
                <Input
                  type="date"
                  value={maintenanceForm.scheduledDate}
                  onChange={(e) => setMaintenanceForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || !selectedEquipment}>
                  {createMutation.isPending ? 'Guardando…' : 'Registrar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
