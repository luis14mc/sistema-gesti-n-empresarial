'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/utils/api';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seatId: string | null;
  initialEmail: string | null;
  onSaved: () => Promise<void> | void;
};

export function EditSeatEmailDialog({ open, onOpenChange, seatId, initialEmail, onSaved }: Props) {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setEmail(initialEmail ?? '');
      setError('');
    }
  }, [open, initialEmail]);

  async function submit() {
    if (!seatId) return;
    setPending(true);
    setError('');
    try {
      await api.patch(`/api/software-licenses/seats/${seatId}`, {
        accountEmail: email.trim() || null,
      });
      onOpenChange(false);
      await onSaved();
    } catch (reason) {
      const message = (reason as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        ?.message;
      setError(message ?? 'No se pudo guardar el correo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar correo de la cuenta</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="seat-account-email">Correo / cuenta</Label>
          <Input
            id="seat-account-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="usuario@dominio.com"
            autoComplete="off"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={pending || !email.trim()}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
