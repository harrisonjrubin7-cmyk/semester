/**
 * The request context: the only way a tenant enters the platform.
 *
 * Everything downstream — policy, repositories, cache keys, queue messages,
 * search filters, audit rows — takes a `RequestContext` and reads the tenant
 * from it. Nothing downstream accepts a bare tenant id from a caller's
 * arguments, because the failure this prevents is the quiet one: a handler
 * that reads `body.tenantId` works perfectly in every test written by someone
 * who only has one tenant.
 *
 * ## The tenant is derived, never submitted
 *
 * `buildRequestContext` takes two inputs and keeps them apart. The
 * `UntrustedRequest` is whatever the client said (headers, body). The
 * `TrustedIdentity` is what the server verified: a membership row, an SSO
 * issuer binding, an LTI deployment, or a service credential bound to a
 * tenant. The tenant is read only from the second. A client that also sent a
 * tenant hint gets `tenant_mismatch` when it disagrees — loudly, because the
 * only honest causes are a bug or an attack, and quietly overriding hides both.
 *
 * It fails closed on every missing piece: no actor, no verified tenant, a
 * tenant that is not `active`, a bad correlation id (replaced, not echoed).
 * The returned object is frozen so a handler cannot widen its own context.
 */

import { HEADERS, header, mintRequestId, resolveCorrelationId, isIdempotencyKey } from '../gateway/headers.ts';
import type { Clock, IdSource } from '../kernel/clock.ts';
import type { ActorType, MfaLevel, PolicyEnvironment, RoleGrant, TenantVerification } from '../seam/institution.ts';
import { TENANT_VERIFICATIONS } from '../seam/institution.ts';
import { PlatformError } from '../gateway/errors.ts';
import { isId, type Tenant } from './organization.ts';

export interface UntrustedRequest {
  headers: Record<string, string | string[] | undefined>;
  /** What the client says the purpose of the request is; checked against the action's allowed purposes by policy. */
  purpose?: string;
}

export interface TrustedIdentity {
  actor: {
    personId: string;
    accountId?: string;
    type: ActorType;
    sessionId?: string;
    authenticatedAt: string;
    mfaLevel?: MfaLevel;
  };
  /** The tenant the server resolved, and how it knows. */
  tenant: Pick<Tenant, 'id' | 'status' | 'environment'> & { verifiedBy: TenantVerification | undefined };
  membershipIds: string[];
  roleGrants: RoleGrant[];
  /** Capabilities the identity layer resolved for this session, flattened. */
  capabilities?: string[];
}

export interface RequestContext {
  readonly tenantId: string;
  readonly environment: PolicyEnvironment;
  readonly verifiedBy: TenantVerification;
  readonly actor: Readonly<TrustedIdentity['actor']>;
  readonly membershipIds: readonly string[];
  readonly roleGrants: readonly RoleGrant[];
  readonly capabilities: readonly string[];
  readonly purpose: string;
  readonly correlationId: string;
  readonly requestId: string;
  readonly idempotencyKey?: string;
  readonly receivedAt: string;
}

export function buildRequestContext(
  request: UntrustedRequest,
  identity: TrustedIdentity | null,
  /** `requestId`, when the host already minted one for its response header, so the two are the same id. It is the server's, never a client's. */
  deps: { clock: Clock; ids: IdSource; requestId?: string },
): RequestContext {
  if (!identity?.actor?.personId || !isId(identity.actor.personId)) {
    throw new PlatformError('unauthenticated', 'Sign in to continue.', {
      userAction: { label: 'Sign in', kind: 'open_screen' },
    });
  }
  const t = identity.tenant;
  if (!t || !isId(t.id) || !t.verifiedBy || !TENANT_VERIFICATIONS.includes(t.verifiedBy)) {
    throw new PlatformError('tenant_unresolved', 'We could not tell which school this request is for.');
  }
  const hint = header(request.headers, HEADERS.tenantHint);
  if (hint !== undefined && hint !== t.id) {
    throw new PlatformError('tenant_mismatch', 'This request names a different school than your session.');
  }
  if (t.status !== 'active') {
    throw new PlatformError('tenant_suspended', 'This school\'s workspace is not available right now.', {
      userAction: { label: 'Contact support', kind: 'contact_support' },
    });
  }

  const key = header(request.headers, HEADERS.idempotencyKey);
  // A malformed key is refused, not ignored: ignoring it would turn a retry the
  // client believes is safe into a second execution.
  if (key !== undefined && !isIdempotencyKey(key)) {
    throw new PlatformError('invalid_request', 'The Idempotency-Key header is not valid.');
  }
  const now = deps.clock.now().toISOString();
  return Object.freeze({
    tenantId: t.id,
    environment: t.environment,
    verifiedBy: t.verifiedBy,
    actor: Object.freeze({ ...identity.actor }),
    membershipIds: Object.freeze([...identity.membershipIds]),
    roleGrants: Object.freeze(identity.roleGrants.map((g) => Object.freeze({ ...g }))),
    capabilities: Object.freeze([...(identity.capabilities ?? [])]),
    purpose: request.purpose ?? 'service_delivery',
    correlationId: resolveCorrelationId(header(request.headers, HEADERS.correlationId), deps.ids),
    requestId: deps.requestId ?? mintRequestId(deps.ids),
    ...(key !== undefined ? { idempotencyKey: key } : {}),
    receivedAt: now,
  });
}

/** What a repository, cache or queue is given instead of a tenant id string. */
export interface TenantScope {
  readonly tenantId: string;
}

export const scopeOf = (ctx: RequestContext): TenantScope => Object.freeze({ tenantId: ctx.tenantId });

/** Throws if a value that carries a tenant carries a different one. The check every adapter makes on the way in and out. */
export function assertSameTenant(scope: TenantScope, carried: { tenantId?: string } | undefined, what: string): void {
  if (!carried || carried.tenantId !== scope.tenantId) {
    throw new PlatformError('tenant_mismatch', `A ${what} from another school was refused.`);
  }
}
