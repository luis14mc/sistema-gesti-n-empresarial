/** Prefijos de objetos generados (exportaciones) que no deben tratarse como huérfanos ni borrarse. */
export const PROTECTED_STORAGE_EXPORT_PREFIXES: RegExp[] = [
  /^organizations\/[^/]+\/payroll\/audits\//,
  /^organizations\/[^/]+\/equipment\/actas-descargo\//,
];

export function isProtectedStorageExportKey(key: string): boolean {
  const normalized = key.replace(/^\/+/, '');
  return PROTECTED_STORAGE_EXPORT_PREFIXES.some((pattern) => pattern.test(normalized));
}
