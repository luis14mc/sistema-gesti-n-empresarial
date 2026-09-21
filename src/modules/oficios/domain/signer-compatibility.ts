import type { OficioDependency } from '@/lib/oficios-numbering';

/**
 * A signer may be used for an oficio when:
 * - signer.dependency is null (authorized for both CNI and Despacho), or
 * - signer.dependency matches the correspondence dependency.
 */
export function isSignerCompatibleWithDependency(
  signerDependency: string | null | undefined,
  oficioDependency: OficioDependency | string,
): boolean {
  if (signerDependency == null || signerDependency === '') return true;
  return signerDependency.toUpperCase() === String(oficioDependency).toUpperCase();
}

export function signerDependencyMismatchMessage(
  signerDependency: string,
  oficioDependency: string,
): string {
  return `El firmante pertenece a ${signerDependency} y no puede firmar correspondencia de ${oficioDependency}.`;
}
