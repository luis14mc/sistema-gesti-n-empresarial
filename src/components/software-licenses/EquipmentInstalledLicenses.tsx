'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/utils/api';
import { STATUS_LABEL } from '@/components/software-licenses/labels';

type InstalledLicense = {
  id: string;
  licenseKey?: string | null;
  licenseKeyPresent?: boolean;
  effectiveStatus?: string;
  status?: string;
  subscription: { id: string; product: { name: string }; planName: string };
};

type SubscriptionOption = {
  id: string;
  product: { name: string };
  planName: string;
  status: string;
};

export function EquipmentInstalledLicenses({
  equipmentId,
  canRead,
  canUpdate,
}: {
  equipmentId: string;
  canRead: boolean;
  canUpdate: boolean;
}) {
  const [items, setItems] = useState<InstalledLicense[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionOption[]>([]);
  const [subscriptionId, setSubscriptionId] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const response = await api.get(`/api/software-licenses/equipment/${equipmentId}`);
    setItems(response.data.data.items ?? []);
  }, [equipmentId]);

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    setLoading(true);
    void reload()
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, reload]);

  useEffect(() => {
    if (!canUpdate) return;
    api
      .get('/api/software-licenses', { params: { page: 1, pageSize: 100, status: 'ACTIVE' } })
      .then((response) => setSubscriptions(response.data.data.items ?? []))
      .catch(() => setSubscriptions([]));
  }, [canUpdate]);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((sub) => sub.status !== 'CANCELLED'),
    [subscriptions],
  );

  async function addLicense() {
    if (!subscriptionId) {
      setError('Seleccione una suscripción.');
      return;
    }
    setError('');
    try {
      await api.post(`/api/software-licenses/${subscriptionId}/seats`, {
        seatType: 'DEVICE',
        equipmentId,
        licenseKey: licenseKey.trim() || null,
      });
      setLicenseKey('');
      setSubscriptionId('');
      await reload();
    } catch {
      setError('No se pudo agregar la licencia al equipo.');
    }
  }

  async function detach(seatId: string) {
    await api.patch(`/api/software-licenses/seats/${seatId}`, { equipmentId: null });
    await reload();
  }

  if (!canRead) return null;

  return (
    <div className="space-y-3" data-testid="equipment-installed-licenses">
      <p className="text-sm font-semibold">Licencias instaladas</p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin licencias DEVICE en este equipo.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Software</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Clave</TableHead>
              <TableHead>Estado</TableHead>
              {canUpdate ? <TableHead className="text-right">Acciones</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const statusKey = item.effectiveStatus ?? item.status ?? 'AVAILABLE';
              return (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      href={`/activos/licencias/${item.subscription.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {item.subscription.product.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.subscription.planName}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.licenseKeyPresent ? (item.licenseKey ?? '•••••') : '—'}
                  </TableCell>
                  <TableCell>{STATUS_LABEL[statusKey] ?? statusKey}</TableCell>
                  {canUpdate ? (
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" type="button" onClick={() => void detach(item.id)}>
                        Quitar
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {canUpdate ? (
        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-sm font-medium">Agregar licencia</p>
          <div className="space-y-1.5">
            <Label>Suscripción</Label>
            <Select value={subscriptionId || undefined} onValueChange={setSubscriptionId}>
              <SelectTrigger>
                <SelectValue placeholder="Elija software / plan" />
              </SelectTrigger>
              <SelectContent>
                {activeSubscriptions.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.product.name} · {sub.planName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Clave (opcional)</Label>
            <Input
              value={licenseKey}
              onChange={(event) => setLicenseKey(event.target.value)}
              placeholder="Se guardará enmascarada en listados"
              autoComplete="off"
            />
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button size="sm" type="button" onClick={() => void addLicense()}>
            Agregar licencia
          </Button>
        </div>
      ) : null}
    </div>
  );
}
