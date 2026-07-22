import { NextResponse } from 'next/server';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stage?: string;
  };
  requestId: string;
}

export interface ApiResponseOptions extends ResponseInit {
  requestId: string;
}

export interface ApiFailureOptions extends ApiResponseOptions {
  details?: unknown;
  stage?: string;
}

function withRequestId(headers: HeadersInit | undefined, requestId: string): Headers {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('x-request-id', requestId);
  return responseHeaders;
}

export function apiSuccess<T>(
  data: T,
  options: ApiResponseOptions,
): NextResponse<ApiSuccess<T>> {
  const { requestId, headers, ...init } = options;

  return NextResponse.json(
    { success: true, data, requestId },
    { ...init, headers: withRequestId(headers, requestId) },
  );
}

export function apiFailure(
  code: string,
  message: string,
  options: ApiFailureOptions,
): NextResponse<ApiFailure> {
  const { requestId, details, stage, headers, ...init } = options;
  const error = {
    code,
    message,
    ...(details === undefined ? {} : { details }),
    ...(stage === undefined ? {} : { stage }),
  };

  return NextResponse.json(
    { success: false, error, requestId },
    { ...init, headers: withRequestId(headers, requestId) },
  );
}
