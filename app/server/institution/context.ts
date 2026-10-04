import type { PolicyEnvironment, UniversityIdentity } from '../../../packages/institution/src/index.ts';
import {
  buildRequestContext,
  systemClock,
  type RequestContext,
  type TrustedIdentity,
} from '../../../packages/platform/src/index.ts';

/**
 * The gateway's verified identity, as the platform's request context.
 *
 * `UniversityIdentity` is what `config.authenticate` returns after `auth.ts`
 * validated the token and `membership.ts` reloaded the person's current tenant
 * and roles from server-controlled records. Everything in it is already
 * server-verified; this only changes its shape into the one every platform
 * primitive takes, so a route that later needs a tenant scope, a policy
 * decision or an idempotency key reads it from one place
 * (`docs/platform/MIGRATION.md`, phase 1).
 *
 * Three approximations, stated rather than hidden:
 *
 * - **`verifiedBy` is `'membership'`.** The identity does not say whether the
 *   grant came from a membership row or from the token's own verified grants;
 *   both are the server's verification, and `'membership'` is the weakest
 *   claim that is true of both.
 * - **The tenant is `active`.** The gateway has no tenant lifecycle yet; a
 *   tenant that authenticated is treated as live. Suspension arrives with the
 *   `platform.tenant` table (phase 3) and will make this a lookup.
 * - **No MFA level.** `authenticate` does not report one, so none is claimed
 *   and a rule that needs fresh MFA will refuse, which is the safe direction.
 *
 * What it does *not* do is relax anything: the platform's id alphabet is
 * `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`, and an identity outside it is refused
 * as `tenant_unresolved` / `unauthenticated` rather than passed through. Every
 * tenant and user id in this repository's tests, contracts and migrations fits
 * it; a real one that does not is the finding this adoption exists to surface.
 */
export function trustedIdentityFor(identity: UniversityIdentity, opts: { environment: PolicyEnvironment; authenticatedAt: string }): TrustedIdentity {
  return {
    actor: { personId: identity.userId, type: 'user', authenticatedAt: opts.authenticatedAt },
    tenant: { id: identity.institutionId, status: 'active', environment: opts.environment, verifiedBy: 'membership' },
    membershipIds: [`${identity.institutionId}:${identity.userId}`],
    roleGrants: identity.roles.map((role) => ({ role, scopeKind: 'tenant', scopeId: identity.institutionId })),
  };
}

/**
 * Build the request context for one gateway request.
 *
 * `requestId` is the one the gateway minted for its `X-Request-Id` header and
 * `correlationId` the one it resolved, so the context, the response headers,
 * the audit rows and the telemetry line all carry the same two ids. They are
 * handed to the builder as headers/deps — never read from the client's request
 * here, which is the builder's rule too.
 *
 * Throws `PlatformError`: `tenant_mismatch` if the client sent an `X-Tenant-Id`
 * that disagrees with the session, `unauthenticated` / `tenant_unresolved` for
 * an identity whose ids are outside the platform's alphabet.
 */
export function contextFor(
  request: Request,
  identity: UniversityIdentity,
  ids: { requestId: string; correlationId: string },
  environment: PolicyEnvironment = 'production',
): RequestContext {
  const now = systemClock.now();
  const tenantHint = request.headers.get('x-tenant-id');
  return buildRequestContext(
    {
      headers: {
        'x-correlation-id': ids.correlationId,
        ...(tenantHint !== null ? { 'x-tenant-id': tenantHint } : {}),
      },
    },
    trustedIdentityFor(identity, { environment, authenticatedAt: now.toISOString() }),
    { clock: systemClock, ids: { next: () => ids.correlationId }, requestId: ids.requestId },
  );
}
