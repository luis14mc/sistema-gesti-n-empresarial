import { isAxiosError, type AxiosError } from 'axios';

export type ApiErrorResponse = {
  error?: string | {
    code?: string;
    message?: string;
    details?: unknown;
    stage?: string;
  };
  message?: string;
  stage?: string;
  details?: Array<{
    field?: string;
    message: string;
  }>;
  requestId?: string;
};

export type NormalizedApiError = {
  code?: string;
  message: string;
  details?: unknown;
  stage?: string;
  requestId?: string;
  status?: number;
};

const API_ERROR_MESSAGES: Record<string, string> = {
  INVALID_ORDER_DATA: 'Revise los datos obligatorios de la orden.',
  TENANT_ACCESS_DENIED: 'No tiene acceso a esta organización o recurso.',
  PDF_BROWSER_NOT_AVAILABLE: 'El servicio de generación de PDF no está disponible.',
  DOCUMENT_NOT_FOUND: 'El documento solicitado no existe.',
  ORGANIZATION_SELECTION_REQUIRED: 'Seleccione una organización para continuar.',
};

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function getApiError(error: unknown, fallback = 'Ocurrió un error inesperado.'): NormalizedApiError {
  const status = getHttpStatus(error);
  const raw = isAxiosError(error) ? error.response?.data as ApiErrorResponse | undefined : undefined;
  const nested = raw?.error && typeof raw.error === 'object' && !Array.isArray(raw.error) ? raw.error : undefined;
  const code = nonEmptyString(nested?.code) ?? (typeof raw?.error === 'string' ? raw.error : undefined);
  const message = nonEmptyString(nested?.message)
    ?? nonEmptyString(raw?.message)
    ?? (code ? API_ERROR_MESSAGES[code] : undefined)
    ?? (error instanceof Error ? nonEmptyString(error.message) : undefined)
    ?? fallback;

  return {
    code,
    message: code && message === code ? API_ERROR_MESSAGES[code] ?? fallback : message,
    details: nested?.details ?? raw?.details,
    stage: nested?.stage ?? raw?.stage,
    requestId: raw?.requestId,
    status,
  };
}

export function getApiErrorData(error: unknown): ApiErrorResponse {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const axiosError = error as AxiosError<ApiErrorResponse>;
    const data = axiosError.response?.data ?? {};
    if (data.error && typeof data.error === 'object' && !Array.isArray(data.error)) {
      return {
        error: data.error.code,
        message: data.error.message,
        stage: data.error.stage,
        details: Array.isArray(data.error.details) ? data.error.details : undefined,
        requestId: data.requestId,
      };
    }
    return data;
  }

  return {};
}

export function getHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('response' in error)) return undefined;
  return (error as AxiosError).response?.status;
}

export type PurchaseOrderValidationDetail = {
  field: string;
  message: string;
};

const PURCHASE_ORDER_API_ERROR_MESSAGES: Record<string, string> = {
  PDF_BROWSER_NOT_AVAILABLE:
    'El motor PDF no está instalado en el servidor.',
  ACTIVE_PURCHASE_FORMAT_NOT_FOUND: 'No existe un formato CNI activo.',
  PURCHASE_ORDER_RENDER_FAILED:
    'No se pudo construir el documento de la orden de compra.',
  PURCHASE_ORDER_PDF_STORAGE_FAILED:
    'El documento fue generado, pero no pudo almacenarse.',
  ORDER_ALREADY_GENERATED: 'Esta orden ya fue generada.',
  PURCHASE_ORDER_ALREADY_GENERATED: 'Esta orden ya fue generada.',
  ORDER_NOT_FOUND: 'La orden solicitada no existe.',
  PURCHASE_ORDER_NOT_FOUND: 'La orden solicitada no existe.',
  ONLY_DRAFT_CAN_BE_DELETED: 'Solo se pueden eliminar órdenes en borrador.',
  DOCUMENT_NOT_FOUND: 'El documento adjunto no existe.',
  INVALID_ORDER_DATA: 'Revise los datos obligatorios de la orden.',
  PURCHASE_ORDER_GENERATION_FAILED: 'No se pudo generar la orden de compra.',
};

export function getPurchaseOrderApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { error?: unknown } | undefined;
    if (typeof data?.error === 'string' && PURCHASE_ORDER_API_ERROR_MESSAGES[data.error]) {
      return PURCHASE_ORDER_API_ERROR_MESSAGES[data.error];
    }
  }
  return getApiErrorMessage(error, fallback);
}

export function getPurchaseOrderValidationDetails(
  error: unknown
): PurchaseOrderValidationDetail[] | undefined {
  if (!isAxiosError(error)) return undefined;
  const data = error.response?.data as { error?: unknown; details?: unknown } | undefined;
  if (data?.error !== 'INVALID_ORDER_DATA' || !Array.isArray(data.details)) return undefined;

  const details = data.details.filter(
    (detail): detail is PurchaseOrderValidationDetail =>
      typeof detail === 'object' &&
      detail !== null &&
      typeof (detail as PurchaseOrderValidationDetail).field === 'string' &&
      typeof (detail as PurchaseOrderValidationDetail).message === 'string'
  );
  return details.length ? details : undefined;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const normalized = getApiError(error, fallback);
  if (normalized.message !== fallback) return normalized.message;
  if (isAxiosError(error)) {
    const data = error.response?.data as { error?: unknown; message?: string } | undefined;

    if (data?.error && typeof data.error === 'object' && 'message' in data.error) {
      const nestedMessage = (data.error as { message?: unknown }).message;
      if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage;
    }

    if (typeof data?.message === 'string' && data.message.trim()) {
      return data.message;
    }

    if (typeof data?.error === 'string' && data.error.trim()) {
      return data.error;
    }

    if (data?.error && typeof data.error === 'object') {
      const flattened = data.error as {
        formErrors?: string[];
        fieldErrors?: Record<string, string[]>;
      };

      const formError = flattened.formErrors?.find(Boolean);
      if (formError) return formError;

      const fieldError = Object.values(flattened.fieldErrors ?? {})
        .flat()
        .find(Boolean);
      if (fieldError) return fieldError;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
