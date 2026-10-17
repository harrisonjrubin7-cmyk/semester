import {
  UNIVERSITY_ROLES,
  type PolicyEnvironment,
  type UniversityIdentity,
  type UniversityRole,
} from '../../../packages/institution/src/index.ts';
import {
  activateContext,
  buildRequestContext,
  isId,
  PlatformError,
  systemClock,
  type ActiveContext,
  type ContextDirectory,
  type ContextSelection,
  type RequestContext,
  type TrustedIdentity,
  type Workspace,
} from '../../../packages/platform/src/index.ts';
import type {
  ContextMembershipDirectory,
  MembershipRecord,
  VerifiedMembershipIdentity,
} from './membership.ts';

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

const WORKSPACE_FOR_ROLE: Readonly<Record<UniversityRole, Workspace>> = Object.freeze({
  student: 'student',
  faculty: 'staff',
  teaching_assistant: 'staff',
  advisor: 'staff',
  admin: 'institution',
  staff: 'staff',
  applicant: 'external',
  payer: 'external',
  family: 'external',
  alumni: 'external',
});

/**
 * Assemble the directory entry the current production authentication flow can
 * prove today: one active institutional membership.
 *
 * Workspace availability is closed over the institution role vocabulary.
 * Nothing in that vocabulary can grant company, operations, or developer
 * access. The membership row id is retained as the evidence identifier; no
 * synthetic role-grant row is claimed, and the signed session expiry remains
 * the only expiry because institution_membership has no expiry column.
 */
export function contextDirectoryForVerifiedIdentity(identity: VerifiedMembershipIdentity): ContextDirectory {
  const workspaces = [...new Set(identity.roles.map((role) => WORKSPACE_FOR_ROLE[role]))];
  return Object.freeze({
    personId: identity.userId,
    sessionExpiresAt: identity.sessionExpiresAt,
    memberships: Object.freeze([Object.freeze({
      id: identity.membershipId,
      tenantId: identity.institutionId,
      institutionId: identity.institutionId,
      personId: identity.userId,
      status: 'active' as const,
      workspaces: Object.freeze(workspaces),
      roleGrantIds: Object.freeze([identity.membershipId]),
    })]),
  });
}

const unavailableDirectory = () => new PlatformError(
  'forbidden',
  'Your current university access does not permit this action.',
);

const sameRoles = (left: readonly UniversityRole[], right: readonly UniversityRole[]): boolean => {
  const normalized = (roles: readonly UniversityRole[]) => [...new Set(roles)].sort();
  return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
};

/**
 * Assemble all active memberships reloaded for the remotely verified account.
 *
 * The membership used during authentication must still be present and must
 * still carry the same institution and roles. That makes loading the wider
 * directory a second authorization check rather than a way to extend a stale
 * session. Inactive rows are omitted; malformed or cross-account rows make the
 * whole directory unavailable instead of being partially trusted.
 */
export function contextDirectoryForVerifiedMemberships(
  identity: VerifiedMembershipIdentity,
  rows: readonly MembershipRecord[],
): ContextDirectory {
  const seen = new Set<string>();
  let currentMembershipProved = false;
  const memberships = rows.flatMap((row) => {
    if (
      !isId(row.id)
      || !isId(row.userId)
      || !isId(row.tenantId)
      || !isId(row.providerId)
      || row.userId !== identity.userId
      || seen.has(row.id)
    ) {
      throw unavailableDirectory();
    }
    seen.add(row.id);
    if (row.status !== 'active') return [];

    const roles = row.roles.filter((role): role is UniversityRole =>
      UNIVERSITY_ROLES.includes(role as UniversityRole),
    );
    if (!roles.length || roles.length !== row.roles.length) throw unavailableDirectory();

    if (row.id === identity.membershipId) {
      if (row.tenantId !== identity.institutionId || !sameRoles(roles, identity.roles)) {
        throw unavailableDirectory();
      }
      currentMembershipProved = true;
    }
    const workspaces = [...new Set(roles.map((role) => WORKSPACE_FOR_ROLE[role]))];
    return [Object.freeze({
      id: row.id,
      tenantId: row.tenantId,
      institutionId: row.tenantId,
      personId: row.userId,
      status: 'active' as const,
      workspaces: Object.freeze(workspaces),
      roleGrantIds: Object.freeze([row.id]),
    })];
  });

  if (!currentMembershipProved) throw unavailableDirectory();
  memberships.sort((left, right) => {
    if (left.id === identity.membershipId) return -1;
    if (right.id === identity.membershipId) return 1;
    return left.tenantId.localeCompare(right.tenantId) || left.id.localeCompare(right.id);
  });
  return Object.freeze({
    personId: identity.userId,
    sessionExpiresAt: identity.sessionExpiresAt,
    memberships: Object.freeze(memberships),
  });
}

export function createContextDirectoryLoader(source: ContextMembershipDirectory) {
  return async (identity: VerifiedMembershipIdentity): Promise<ContextDirectory> =>
    contextDirectoryForVerifiedMemberships(identity, await source.membershipsForUser(identity.userId));
}

export interface ContextActivationRequest extends ContextSelection {
  confirmed: boolean;
}

export interface SelectedMembershipAuthority {
  readonly membershipId: string;
  readonly personId: string;
  readonly tenantId: string;
  readonly providerId: string;
  readonly roles: readonly UniversityRole[];
}

export interface VerifiedContextActivation {
  readonly activeContext: ActiveContext;
  readonly membershipAuthority: SelectedMembershipAuthority;
}

/**
 * Resolve one explicitly confirmed selection against a freshly reloaded
 * server-side membership directory.
 *
 * This returns only the selected `ActiveContext`. It deliberately does not
 * build a gateway `RequestContext`, select an adapter, expose a route, or
 * authorize an action. Those boundaries need the selected membership's role
 * evidence and their own adoption contract before cross-institution requests
 * can become live.
 */
export function createContextActivationRequester(source: ContextMembershipDirectory) {
  const loadDirectory = createContextDirectoryLoader(source);
  return async (
    identity: VerifiedMembershipIdentity,
    selection: ContextActivationRequest,
  ): Promise<ActiveContext> => {
    if (!selection.confirmed) {
      throw new PlatformError('conflict', 'Confirm the membership and workspace before activating context.');
    }
    return activateContext(await loadDirectory(identity), selection, systemClock.now().getTime());
  };
}

/**
 * Resolve a confirmed selection together with its freshly reloaded authority.
 *
 * The returned roles and provider id come from the same authoritative row used
 * to assemble and activate the directory. They are intentionally kept in this
 * server-only result instead of being added to the client-facing
 * `ActiveContext`. This is evidence for a later authorization boundary; it is
 * not itself a `RequestContext`, adapter selection, or action authorization.
 */
export function createVerifiedContextActivationRequester(source: ContextMembershipDirectory) {
  return async (
    identity: VerifiedMembershipIdentity,
    selection: ContextActivationRequest,
  ): Promise<VerifiedContextActivation> => {
    if (!selection.confirmed) {
      throw new PlatformError('conflict', 'Confirm the membership and workspace before activating context.');
    }
    const rows = await source.membershipsForUser(identity.userId);
    const activeContext = activateContext(
      contextDirectoryForVerifiedMemberships(identity, rows),
      selection,
      systemClock.now().getTime(),
    );
    const selected = rows.find((row) => row.id === activeContext.membershipId && row.status === 'active');
    if (selected === undefined) throw unavailableDirectory();
    const roles = selected.roles.filter((role): role is UniversityRole =>
      UNIVERSITY_ROLES.includes(role as UniversityRole),
    );
    if (!roles.length || roles.length !== selected.roles.length) throw unavailableDirectory();

    const membershipAuthority: SelectedMembershipAuthority = Object.freeze({
      membershipId: selected.id,
      personId: selected.userId,
      tenantId: selected.tenantId,
      providerId: selected.providerId,
      roles: Object.freeze([...new Set(roles)]),
    });
    return Object.freeze({ activeContext, membershipAuthority });
  };
}

/** Only the request headers that the shared platform context is allowed to trust. */
function platformHeaders(
  request: Request,
  correlationId: string,
): Record<string, string> {
  const tenantHint = request.headers.get('x-tenant-id');
  const idempotencyKey = request.headers.get('idempotency-key');
  return {
    'x-correlation-id': correlationId,
    ...(tenantHint !== null ? { 'x-tenant-id': tenantHint } : {}),
    ...(idempotencyKey !== null ? { 'idempotency-key': idempotencyKey } : {}),
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
  purpose?: string,
): RequestContext {
  const now = systemClock.now();
  return buildRequestContext(
    {
      headers: platformHeaders(request, ids.correlationId),
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

  const base = buildRequestContext(
    {
      headers: platformHeaders(request, ids.correlationId),
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

/** The production-authenticated, single-membership adoption seam. */
export function contextForVerifiedSelection(
  request: Request,
  identity: VerifiedMembershipIdentity,
  selection: ContextSelection,
  ids: { requestId: string; correlationId: string },
  environment: PolicyEnvironment = 'production',
  purpose?: string,
): ActiveInstitutionRequestContext {
  return contextForSelection(
    request,
    identity,
    { directory: contextDirectoryForVerifiedIdentity(identity), selection },
    ids,
    environment,
    purpose,
  );
}
