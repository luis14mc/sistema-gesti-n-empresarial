// ============================================
// SWEETALERT2 — Configuración institucional
// ============================================
// Helpers preconfigurados con colores del sistema
// y detección automática de dark mode.

import Swal, { SweetAlertResult } from 'sweetalert2';

// ============================================
// HELPERS
// ============================================

/** Detecta si el modo oscuro está activo */
function isDark(): boolean {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
}

/** Colores base según el tema activo */
function themeColors() {
    const dark = isDark();
    return {
        background: dark ? '#141829' : '#ffffff',
        color: dark ? '#e8eaf0' : '#1a1d3e',
        confirmButtonColor: '#25A966',
        cancelButtonColor: dark ? '#374151' : '#6b7280',
    };
}

// ============================================
// FUNCIONES EXPORTADAS
// ============================================

/** Modal de confirmación (ej: eliminar un registro) */
export function swalConfirm(
    title: string,
    text: string,
    confirmText = 'Sí, confirmar'
): Promise<SweetAlertResult> {
    const tc = themeColors();
    return Swal.fire({
        title,
        text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: tc.confirmButtonColor,
        cancelButtonColor: tc.cancelButtonColor,
        confirmButtonText: confirmText,
        cancelButtonText: 'Cancelar',
        background: tc.background,
        color: tc.color,
        customClass: {
            popup: 'rounded-xl shadow-2xl',
        },
    });
}

/** Modal de éxito */
export function swalSuccess(title: string, text?: string) {
    const tc = themeColors();
    return Swal.fire({
        title,
        text,
        icon: 'success',
        confirmButtonColor: tc.confirmButtonColor,
        background: tc.background,
        color: tc.color,
        timer: 2500,
        showConfirmButton: false,
    });
}

/** Modal de error */
export function swalError(title: string, text?: string) {
    const tc = themeColors();
    return Swal.fire({
        title,
        text,
        icon: 'error',
        confirmButtonColor: tc.confirmButtonColor,
        background: tc.background,
        color: tc.color,
    });
}

/** Modal de información */
export function swalInfo(title: string, text?: string) {
    const tc = themeColors();
    return Swal.fire({
        title,
        text,
        icon: 'info',
        confirmButtonColor: tc.confirmButtonColor,
        background: tc.background,
        color: tc.color,
    });
}

export default Swal;
