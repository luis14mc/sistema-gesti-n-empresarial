'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/utils/api';
import { STATUS_LABEL } from '@/components/software-licenses/labels';

type SubscriptionOption = {
  id: string;
  product: { name: string };
  planName: string;
  status: string;
};

type SeatOption = {
  id: string;
  seatType: 'INDIVIDUAL' | 'SHARED' | 'DEVICE';
  accountEmail?: string | null;
  effectiveStatus?: string;
  status?: string;
  activeAssignments?: number;
};

type Props = {
  employeeId: string;
  employeeName: string;
  onAssigned?: () => void;
};

export function AssignLicenseDialog({ employeeId, employeeName, onAssigned }: Props) {
  const [open, setOpen] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionOption[]>([]);
  const [subscriptionId, setSubscriptionId] = useState('');
  const [seats, setSeats] = useState<SeatOption[]>([]);
  const [seatId, setSeatId] = useState('');
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [newEmail, setNewEmail] = useState('');
  const [newType, setNewType] = useState<'INDIVIDUAL' | 'SHARED'>('INDIVIDUAL');
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    api
      .get('/api/software-licenses', { params: { page: 1, pageSize: 100, status: 'ACTIVE' } })
      .then((response) => setSubscriptions(response.data.data.items ?? []))
      .catch(() => setSubscriptions([]));
  }, [open]);

  useEffect(() => {
    if (!open || !subscriptionId) {
      setSeats([]);
      setSeatId('');
      return;
    }
    let cancelled = false;
    setLoadingSeats(true);
    api
      .get(`/api/software-licenses/${subscriptionId}`)
      .then((response) => {
        if (cancelled) return;
        const raw = (response.data.data.seats ?? []) as SeatOption[];
        const free = raw.filter(
          (seat) =>
            (seat.seatType === 'INDIVIDUAL' || seat.seatType === 'SHARED') &&
            seat.status !== 'CANCELLED' &&
            seat.status !== 'SUSPENDED' &&
            (seat.effectiveStatus === 'AVAILABLE' || seat.status === 'AVAILABLE') &&
            (seat.seatType !== 'INDIVIDUAL' || (seat.activeAssignments ?? 0) === 0),
        );
        setSeats(free);
        setSeatId(free[0]?.id ?? '');
      })
      .catch(() => {
        if (!cancelled) setSeats([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSeats(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, subscriptionId]);

  const activeSubscriptions = useMemo(
    () => subscriptions.filter((sub) => sub.status !== 'CANCELLED'),
    [subscriptions],
  );

  function closeSuccess() {
    setOpen(false);
    setSubscriptionId('');
    setSeatId('');
    setNewEmail('');
    setError('');
    onAssigned?.();
  }

  async function assignExisting() {
    setError('');
    try {
      await api.post(`/api/software-licenses/seats/${seatId}/assignments`, { employeeId });
      closeSuccess();
    } catch (reason) {
      const message = (reason as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        ?.message;
      setError(message ?? 'No se pudo asignar.');
    }
  }

  async function createAndAssign() {
    setError('');
    try {
      const created = await api.post(`/api/software-licenses/${subscriptionId}/seats`, {
        seatType: newType,
        accountEmail: newEmail.trim(),
        employeeId: newType === 'INDIVIDUAL' ? employeeId : undefined,
      });
      const newSeatId = created.data.data.id as string;
      if (newType === 'SHARED') {
        await api.post(`/api/software-licenses/seats/${newSeatId}/assignments`, { employeeId });
      }
      closeSuccess();
    } catch (reason) {
      const message = (reason as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        ?.message;
      setError(message ?? 'No se pudo crear y asignar.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" type="button">
          Asignar licencia
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Licencia para {employeeName}</DialogTitle>
          <DialogDescription>Elija suscripción, licencia libre o cree una cuenta nueva.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <Label>Suscripción</Label>
            <Select
              value={subscriptionId || undefined}
              onValueChange={(value) => {
                setSubscriptionId(value);
                setMode('existing');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Software / plan" />
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

          {subscriptionId ? (
            <>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === 'existing' ? 'default' : 'outline'}
                  onClick={() => setMode('existing')}
                >
                  Licencia libre
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === 'new' ? 'default' : 'outline'}
                  onClick={() => setMode('new')}
                >
                  Crear cuenta nueva
                </Button>
              </div>

              {mode === 'existing' ? (
                <div className="space-y-1.5">
                  <Label>Licencia disponible</Label>
                  {loadingSeats ? (
                    <p className="text-muted-foreground">Cargando licencias…</p>
                  ) : seats.length === 0 ? (
                    <p className="text-muted-foreground">No hay cuentas libres; use «Crear cuenta nueva».</p>
                  ) : (
                    <Select value={seatId || undefined} onValueChange={setSeatId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Cuenta" />
                      </SelectTrigger>
                      <SelectContent>
                        {seats.map((seat) => (
                          <SelectItem key={seat.id} value={seat.id}>
                            {STATUS_LABEL[seat.seatType] ?? seat.seatType} · {seat.accountEmail ?? seat.id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button type="button" size="sm" disabled={!seatId} onClick={() => void assignExisting()}>
                    Asignar
                  </Button>
                </div>
              ) : (
                <div className="space-y-1.5 border-t pt-3">
                  <Label>Tipo</Label>
                  <Select value={newType} onValueChange={(v) => setNewType(v as 'INDIVIDUAL' | 'SHARED')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">Cuenta personal</SelectItem>
                      <SelectItem value="SHARED">Cuenta compartida</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label>Correo de la cuenta</Label>
                  <Input
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    placeholder="usuario@dominio.com"
                    type="email"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void createAndAssign()}
                    disabled={!newEmail.trim()}
                  >
                    Crear y asignar
                  </Button>
                </div>
              )}
            </>
          ) : null}

          {error ? <p className="text-destructive">{error}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
