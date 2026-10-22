'use client';

import { Button } from '@/components/ui/button';
import { swalConfirm } from '@/lib/swal';

export type MaintenanceWorkflowStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type MaintenanceTransitionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

const CONFIRM: Record<
  MaintenanceTransitionStatus,
  { title: string; text: string }
> = {
  IN_PROGRESS: {
    title: '¿Iniciar mantenimiento?',
    text: 'El equipo quedará en estado En mantenimiento.',
  },
  COMPLETED: {
    title: '¿Completar mantenimiento?',
    text: 'Se registrará como completado. Si no hay otros mantenimientos abiertos, el equipo volverá a Disponible.',
  },
  CANCELLED: {
    title: '¿Cancelar mantenimiento?',
    text: 'El mantenimiento se marcará como cancelado.',
  },
};

export function MaintenanceWorkflowActions({
  maintenanceId,
  status,
  disabled,
  onStatusChange,
}: {
  maintenanceId: string;
  status: MaintenanceWorkflowStatus | string;
  disabled?: boolean;
  onStatusChange: (maintenanceId: string, nextStatus: MaintenanceTransitionStatus) => Promise<void>;
}) {
  if (status !== 'SCHEDULED' && status !== 'IN_PROGRESS') {
    return null;
  }

  const run = async (nextStatus: MaintenanceTransitionStatus) => {
    const confirm = CONFIRM[nextStatus];
    const result = await swalConfirm(confirm.title, confirm.text, 'Confirmar');
    if (!result.isConfirmed) return;
    await onStatusChange(maintenanceId, nextStatus);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status === 'SCHEDULED' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={disabled}
          onClick={() => void run('IN_PROGRESS')}
        >
          Iniciar
        </Button>
      )}
      {status === 'IN_PROGRESS' && (
        <Button
          type="button"
          variant="default"
          size="sm"
          className="h-8"
          disabled={disabled}
          onClick={() => void run('COMPLETED')}
        >
          Completar
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 text-destructive hover:text-destructive"
        disabled={disabled}
        onClick={() => void run('CANCELLED')}
      >
        Cancelar
      </Button>
    </div>
  );
}
