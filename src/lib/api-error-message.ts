type ApiErrorPayload = {
  success?: boolean;
  error?: string | { code?: string; message?: string };
  message?: string;
  requestId?: string;
};

export function parseApiErrorPayload(body: unknown): {
  message: string | null;
  requestId: string | null;
  code: string | null;
} {
  if (!body || typeof body !== 'object') {
    return { message: null, requestId: null, code: null };
  }
  const payload = body as ApiErrorPayload;
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : null;

  if (typeof payload.error === 'string') {
    return { message: payload.error, requestId, code: null };
  }
  if (payload.error && typeof payload.error === 'object') {
    const message =
      typeof payload.error.message === 'string' ? payload.error.message : null;
    const code = typeof payload.error.code === 'string' ? payload.error.code : null;
    return { message, requestId, code };
  }
  if (typeof payload.message === 'string') {
    return { message: payload.message, requestId, code: null };
  }
  return { message: null, requestId, code: null };
}

const ROLES_MANAGE_FORBIDDEN_MESSAGE =
  'No tiene permiso para administrar roles (roles.manage). Cierre sesión y vuelva a entrar si se lo acaban de otorgar.';

/** User-facing message for roles / permissions API responses. */
export function formatRolesApiErrorMessage(
  status: number,
  body: unknown,
  fallback: string,
): string {
  const { message, requestId } = parseApiErrorPayload(body);

  if (status === 403) {
    return ROLES_MANAGE_FORBIDDEN_MESSAGE;
  }
  if (status === 400 || status === 404) {
    return 'Rol no válido';
  }
  if (status >= 500) {
    return requestId
      ? `Error del servidor (referencia: ${requestId})`
      : 'Error del servidor';
  }

  return message ?? fallback;
}

/** Generic extractor for API failures (string or apiFailure envelope). */
export function extractApiErrorMessage(
  body: unknown,
  fallback: string,
  status?: number,
): string {
  if (status !== undefined) {
    return formatRolesApiErrorMessage(status, body, fallback);
  }
  const { message } = parseApiErrorPayload(body);
  return message ?? fallback;
}

export async function readApiErrorFromResponse(
  res: Response,
  fallback: string,
  options?: { rolesContext?: boolean },
): Promise<string> {
  const body = await res.json().catch(() => null);
  if (options?.rolesContext) {
    return formatRolesApiErrorMessage(res.status, body, fallback);
  }
  return extractApiErrorMessage(body, fallback, res.status);
}
