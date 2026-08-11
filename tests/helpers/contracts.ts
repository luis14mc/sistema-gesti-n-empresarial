import { expect } from 'vitest';
import type { ApiFailure, ApiSuccess } from '@/platform/api/response';

export function expectSuccessEnvelope<T>(
  body: unknown,
  expectations: { requestId: string; data?: Partial<T> } = { requestId: '' },
): asserts body is ApiSuccess<T> {
  expect(body).toBeTypeOf('object');
  expect(body).not.toBeNull();
  const value = body as Record<string, unknown>;
  expect(value.success).toBe(true);
  expect(value.requestId).toBe(expectations.requestId);
  expect(value).toHaveProperty('data');
  if (expectations.data) {
    expect(value.data).toMatchObject(expectations.data);
  }
  expect(value).not.toHaveProperty('error');
}

export function expectFailureEnvelope(
  body: unknown,
  expectations: { requestId: string; code: string; message?: RegExp; stage?: string },
): asserts body is ApiFailure {
  expect(body).toBeTypeOf('object');
  expect(body).not.toBeNull();
  const value = body as Record<string, unknown>;
  expect(value.success).toBe(false);
  expect(value.requestId).toBe(expectations.requestId);
  const error = value.error as Record<string, unknown>;
  expect(error).toBeTypeOf('object');
  expect(error.code).toBe(expectations.code);
  if (expectations.message) {
    expect(error.message).toMatch(expectations.message);
  }
  if (expectations.stage) {
    expect(error.stage).toBe(expectations.stage);
  }
  expect(value).not.toHaveProperty('data');
}

export function expectRequestIdHeader(headers: Headers, requestId: string): void {
  expect(headers.get('x-request-id')).toBe(requestId);
}

export function expectSafeEnvelope(body: unknown, bannedKeys: readonly string[] = ['password', 'secret', 'token', 'authorization']): void {
  const serialized = JSON.stringify(body).toLowerCase();
  for (const key of bannedKeys) {
    expect(serialized, `envelope leaked the key "${key}"`).not.toContain(`"${key}":`);
  }
}
