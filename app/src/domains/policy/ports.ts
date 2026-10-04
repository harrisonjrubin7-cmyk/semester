import type { Decision, PolicyAction } from './model';

/**
 * A question already bound to a person and an environment.
 *
 * Use cases take this rather than a principal, so they cannot ask about anybody
 * but the person the host bound it to, and tests pass `() => allowed` without
 * building an identity.
 */
export type Can = (action: PolicyAction) => Decision;
