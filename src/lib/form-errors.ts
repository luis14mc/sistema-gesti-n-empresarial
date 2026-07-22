import type { FieldErrors, FieldValues } from 'react-hook-form';

function isFieldError(value: unknown): value is { message?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

export function getFirstFormErrorMessage(
  errors: FieldErrors<FieldValues>
): string | undefined {
  for (const value of Object.values(errors)) {
    if (!value) continue;

    if (isFieldError(value) && value.message) {
      return value.message;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (!item) continue;
        const nested = getFirstFormErrorMessage(item as FieldErrors<FieldValues>);
        if (nested) return nested;
      }
      continue;
    }

    if (typeof value === 'object') {
      const nested = getFirstFormErrorMessage(value as FieldErrors<FieldValues>);
      if (nested) return nested;
    }
  }

  return undefined;
}

export function getFirstErrorField(
  errors: FieldErrors<FieldValues>,
  prefix = ''
): string | undefined {
  for (const [key, value] of Object.entries(errors)) {
    if (!value) continue;

    const path = prefix ? `${prefix}.${key}` : key;

    if (isFieldError(value) && value.message) {
      return path;
    }

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const item = value[index];
        if (!item) continue;
        const nested = getFirstErrorField(
          { [index]: item } as FieldErrors<FieldValues>,
          path
        );
        if (nested) return nested;
      }
      continue;
    }

    if (typeof value === 'object') {
      const nested = getFirstErrorField(value as FieldErrors<FieldValues>, path);
      if (nested) return nested;
    }
  }

  return undefined;
}
