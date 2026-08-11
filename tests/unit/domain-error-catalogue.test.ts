// Phase 10B — domain unit tests for the platform domain error → HTTP mapping.
import { describe, expect, it } from 'vitest';
import {
  AlreadyProcessedError,
  ConcurrentModificationError,
  DomainConflictError,
  DocumentGenerationFailedError,
  EntityNotFoundError,
  ExternalIntegrationFailedError,
  InvalidDomainDataError,
  InvalidStatusTransitionError,
  PermissionDeniedError,
  SequenceAllocationFailedError,
  StorageFailedError,
  isDomainError,
} from '@/platform/domain/errors';

describe('domain error catalogue', () => {
  it('EntityNotFoundError exposes a 404 status', () => {
    expect(new EntityNotFoundError().code).toBe('ENTITY_NOT_FOUND');
    expect(new EntityNotFoundError().httpStatus).toBe(404);
  });

  it('InvalidDomainDataError exposes a 422 status', () => {
    expect(new InvalidDomainDataError().code).toBe('INVALID_DOMAIN_DATA');
    expect(new InvalidDomainDataError().httpStatus).toBe(422);
  });

  it('InvalidStatusTransitionError encodes the transition in details', () => {
    const error = new InvalidStatusTransitionError('DRAFT', 'APPROVED');
    expect(error.code).toBe('INVALID_STATUS_TRANSITION');
    expect(error.httpStatus).toBe(409);
    expect(error.details).toMatchObject({ from: 'DRAFT', to: 'APPROVED' });
  });

  it('DomainConflictError exposes a 409 status', () => {
    expect(new DomainConflictError().code).toBe('DOMAIN_CONFLICT');
    expect(new DomainConflictError().httpStatus).toBe(409);
  });

  it('AlreadyProcessedError exposes a 409 status', () => {
    expect(new AlreadyProcessedError().code).toBe('ALREADY_PROCESSED');
    expect(new AlreadyProcessedError().httpStatus).toBe(409);
  });

  it('PermissionDeniedError exposes a 403 status', () => {
    expect(new PermissionDeniedError().code).toBe('PERMISSION_DENIED');
    expect(new PermissionDeniedError().httpStatus).toBe(403);
  });

  it('ConcurrentModificationError exposes a 409 status', () => {
    expect(new ConcurrentModificationError().code).toBe('CONCURRENT_MODIFICATION');
    expect(new ConcurrentModificationError().httpStatus).toBe(409);
  });

  it('SequenceAllocationFailedError exposes a 500 status', () => {
    expect(new SequenceAllocationFailedError().code).toBe('SEQUENCE_ALLOCATION_FAILED');
    expect(new SequenceAllocationFailedError().httpStatus).toBe(500);
  });

  it('DocumentGenerationFailedError exposes a 500 status', () => {
    expect(new DocumentGenerationFailedError().code).toBe('DOCUMENT_GENERATION_FAILED');
    expect(new DocumentGenerationFailedError().httpStatus).toBe(500);
  });

  it('StorageFailedError exposes a 500 status', () => {
    expect(new StorageFailedError().code).toBe('STORAGE_FAILED');
    expect(new StorageFailedError().httpStatus).toBe(500);
  });

  it('ExternalIntegrationFailedError exposes a 502 status', () => {
    expect(new ExternalIntegrationFailedError().code).toBe('EXTERNAL_INTEGRATION_FAILED');
    expect(new ExternalIntegrationFailedError().httpStatus).toBe(502);
  });

  it('every domain error is recognised by isDomainError', () => {
    const errors = [
      new EntityNotFoundError(),
      new InvalidDomainDataError(),
      new InvalidStatusTransitionError('a', 'b'),
      new DomainConflictError(),
      new AlreadyProcessedError(),
      new PermissionDeniedError(),
      new ConcurrentModificationError(),
      new SequenceAllocationFailedError(),
      new DocumentGenerationFailedError(),
      new StorageFailedError(),
      new ExternalIntegrationFailedError(),
    ];
    for (const error of errors) {
      expect(isDomainError(error)).toBe(true);
    }
  });

  it('isDomainError returns false for non-domain errors', () => {
    expect(isDomainError(new Error('regular'))).toBe(false);
    expect(isDomainError('a string')).toBe(false);
    expect(isDomainError(null)).toBe(false);
    expect(isDomainError(undefined)).toBe(false);
  });

  it('passes the cause option to the underlying Error', () => {
    const cause = new Error('underlying');
    const error = new SequenceAllocationFailedError({ retry: false }, { cause });
    expect(error.cause).toBe(cause);
  });
});
