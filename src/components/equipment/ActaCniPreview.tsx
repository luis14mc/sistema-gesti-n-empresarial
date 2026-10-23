'use client';

type ActaCniPreviewProps = {
  assignmentId: string;
  type: 'delivery' | 'return';
  className?: string;
};

/** Vista previa HTML del acta CNI (requiere sesión autenticada). */
export function ActaCniPreview({ assignmentId, type, className }: ActaCniPreviewProps) {
  const src = `/api/equipment-assignments/${assignmentId}/acta?type=${type}`;
  return (
    <iframe
      title={type === 'delivery' ? 'Acta de asignación CNI' : 'Acta de devolución CNI'}
      src={src}
      className={className ?? 'w-full min-h-[720px] border rounded-lg bg-white'}
    />
  );
}
