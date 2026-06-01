'use client';

import Swal from 'sweetalert2';

/**
 * Modal de confirmación para acciones destructivas.
 * Usa los colores institucionales del sistema.
 */
export async function confirmDestructive(opts: {
  title: string;
  text: string;
  confirmText?: string;
}): Promise<boolean> {
  const result = await Swal.fire({
    title: opts.title,
    text: opts.text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#25A966',
    cancelButtonColor: '#ef4444',
    confirmButtonText: opts.confirmText ?? 'Sí, continuar',
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    customClass: {
      popup: 'rounded-xl shadow-2xl',
      title: 'text-lg font-semibold',
    },
  });
  return result.isConfirmed;
}

/**
 * Modal informativo de éxito.
 */
export async function showSuccess(title: string, text?: string) {
  await Swal.fire({
    title,
    text,
    icon: 'success',
    confirmButtonColor: '#25A966',
    timer: 2000,
    timerProgressBar: true,
  });
}
