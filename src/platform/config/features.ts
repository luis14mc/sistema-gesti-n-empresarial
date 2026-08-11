/**
 * Phase 14C/14D — Feature gates for foundation-only capabilities.
 *
 * The SGE is an internal CNI system, not a SaaS platform. The following
 * capabilities exist in the codebase as foundations but are NOT operational for
 * the internal release. They are disabled at runtime here (routes return 404 via
 * the shared route runners) without deleting any code or schema, so they can be
 * activated later behind an explicit environment decision.
 *
 * All default to DISABLED. Set the env var to "true"/"1" to enable.
 */

function envFlag(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return raw === 'true' || raw === '1';
}

export const FEATURES = {
  /** Platform/organization lifecycle administration (/api/platform/**). */
  platformAdmin: envFlag('SGE_ENABLE_PLATFORM_ADMIN', false),
  /** Generic external-integration framework (/api/organizations/current/integrations/**). */
  integrations: envFlag('SGE_ENABLE_INTEGRATIONS', false),
  /** In-app / multi-channel notifications (/api/notifications/**). */
  notifications: envFlag('SGE_ENABLE_NOTIFICATIONS', false),
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isFeatureEnabled(feature: FeatureName): boolean {
  return FEATURES[feature];
}

/** Thrown when a disabled foundation endpoint is invoked. Surfaced as 404. */
export class FeatureDisabledError extends Error {
  readonly code = 'FEATURE_NOT_AVAILABLE';
  readonly status = 404;
  constructor(public readonly feature: FeatureName) {
    super(`FEATURE_DISABLED:${feature}`);
    this.name = 'FeatureDisabledError';
  }
}
