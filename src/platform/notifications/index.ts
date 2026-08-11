'use client';

import Swal, { type SweetAlertOptions } from 'sweetalert2';

type NotificationOptions = {
  title: string;
  message?: string;
};
export type NotificationInput = string | NotificationOptions;

type ConfirmInput = string | (NotificationOptions & Partial<Pick<SweetAlertOptions, 'confirmButtonText' | 'cancelButtonText'>>);

function toOptions(input: NotificationInput, message?: string): SweetAlertOptions {
  if (typeof input === 'string') return { title: input, text: message };
  return { title: input.title, text: input.message };
}

const provider = Swal.mixin({
  customClass: { popup: 'font-[Aptos,"Segoe_UI",sans-serif]' },
  confirmButtonText: 'Aceptar',
});

export const notification = {
  success(input: NotificationInput, message?: string) {
    return provider.fire({ icon: 'success', ...toOptions(input, message) });
  },
  error(input: NotificationInput, message?: string) {
    return provider.fire({ icon: 'error', ...toOptions(input, message) });
  },
  warning(input: NotificationInput, message?: string) {
    return provider.fire({ icon: 'warning', ...toOptions(input, message) });
  },
  info(input: NotificationInput, message?: string) {
    return provider.fire({ icon: 'info', ...toOptions(input, message) });
  },
  async confirm(input: ConfirmInput, message?: string): Promise<boolean> {
    const custom: Partial<Pick<SweetAlertOptions, 'confirmButtonText' | 'cancelButtonText'>> = typeof input === 'string' ? {} : input;
    const result = await provider.fire({
      icon: 'warning',
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: custom.confirmButtonText ?? 'Confirmar',
      cancelButtonText: custom.cancelButtonText ?? 'Cancelar',
      ...toOptions(input, message),
    });
    return result.isConfirmed;
  },
  loading(input: NotificationInput = 'Procesando…', message?: string) {
    void provider.fire({
      allowEscapeKey: false,
      allowOutsideClick: false,
      showConfirmButton: false,
      ...toOptions(input, message),
      didOpen: () => Swal.showLoading(),
    });
    return () => Swal.close();
  },
};

export default notification;
