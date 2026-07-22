import { NextResponse } from 'next/server';

/** Marca respuestas de APIs legacy de compras como obsoletas. */
export function deprecatedComprasResponse<T>(body: T, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Deprecation', 'true');
  response.headers.set('Link', '</api/compras/ordenes>; rel="successor-version"');
  return response;
}
