// Phase 10A — re-exports the test factories used by the security
// regression, contract, and integration suites. Keep this index file
// thin: it only re-exports. New factories go in their own file.
export * from './organizations';
export * from './users';
export * from './equipment';
export * from './oficios';
export * from './disposal';
export * from './purchases';
export * from './integrations';
export * from './notifications';
export * from './permissions';
