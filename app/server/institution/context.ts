import type { PolicyEnvironment, UniversityIdentity } from '../../../packages/institution/src/index.ts';
import {
  activateContext,
  buildRequestContext,
  PlatformError,
  systemClock,
  type ActiveContext,
  type ContextDirectory,
  type ContextSelection,
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
interface TrustedIdentityOptions {
  environment: PolicyEnvironment;
  authenticatedAt: string;
  membershipId?: string;
  roleGrantExpiresAt?: string;
}

export function trustedIdentityFor(identity: UniversityIdentity, opts: TrustedIdentityOptions): TrustedIdentity {
  return {
    actor: { personId: identity.userId, type: 'user', authenticatedAt: opts.authenticatedAt },
    tenant: { id: identity.institutionId, status: 'active', environment: opts.environment, verifiedBy: 'membership' },
    membershipIds: [opts.membershipId ?? `${identity.institutionId}:${identity.userId}`],
    roleGrants: identity.roles.map((role) => ({
      role,
      scopeKind: 'tenant',
      scopeId: identity.institutionId,
      ...(opts.roleGrantExpiresAt === undefined ? {} : { expiresAt: opts.roleGrantExpiresAt }),
    })),
  };
}

export interface ActiveInstitutionRequestContext extends RequestContext {
  readonly activeContext: ActiveContext;
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
  purpose?: string,
): RequestContext {
  const now = systemClock.now();
  const tenantHint = request.headers.get('x-tenant-id');
  return buildRequestContext(
    {
      headers: {
        'x-correlation-id': ids.correlationId,
        ...(tenantHint !== null ? { 'x-tenant-id': tenantHint } : {}),
      },
      purpose,
    },
    trustedIdentityFor(identity, { environment, authenticatedAt: now.toISOString() }),
    { clock: systemClock, ids: { next: () => ids.correlationId }, requestId: ids.requestId },
  );
}

/**
 * Build a gateway context from an explicit membership/workspace selection.
 *
 * The selection may have originated in the client, but every value that gains
 * authority is re-derived by `activateContext` from the server-reloaded
 * directory. The authenticated identity remains an independent check: a
 * directory for another person or tenant is refused before any handler sees
 * it. This is the adoption seam for routes that need workspace-aware policy;
 * legacy routes continue through `contextFor` until their authentication
 * result carries a verified directory and session expiry.
 */
export function contextForSelection(
  request: Request,
  identity: UniversityIdentity,
  verified: { directory: ContextDirectory; selection: ContextSelection },
  ids: { requestId: string; correlationId: string },
  environment: PolicyEnvironment = 'production',
  purpose?: string,
): ActiveInstitutionRequestContext {
  const now = systemClock.now();
  if (verified.directory.personId !== identity.userId) {
    throw new PlatformError('unauthenticated', 'The selected workspace does not belong to this signed-in account.');
  }
  const activeContext = activateContext(verified.directory, verified.selection, now.getTime());
  if (
    activeContext.tenantId !== identity.institutionId ||
    (activeContext.institutionId !== undefined && activeContext.institutionId !== identity.institutionId)
  ) {
    throw new PlatformError('tenant_mismatch', 'The selected workspace belongs to a different school than your session.');
  }

  const tenantHint = request.headers.get('x-tenant-id');
  const base = buildRequestContext(
    {
      headers: {
        'x-correlation-id': ids.correlationId,
        ...(tenantHint !== null ? { 'x-tenant-id': tenantHint } : {}),
      },
      purpose,
    },
    trustedIdentityFor(identity, {
      environment,
      authenticatedAt: now.toISOString(),
      membershipId: activeContext.membershipId,
      roleGrantExpiresAt: activeContext.expiresAt,
    }),
    { clock: { now: () => now }, ids: { next: () => ids.correlationId }, requestId: ids.requestId },
  );
  return Object.freeze({ ...base, activeContext });
}
