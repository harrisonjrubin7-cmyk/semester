import type { UniversityIdentity } from '../../../packages/institution/src/index.ts';
import { supabaseIdentity } from '../institution/auth.ts';
import { createMembershipResolver, supabaseMembershipDirectory } from '../institution/membership.ts';
import { DEFAULT_RATE_LIMIT, PostgresRateLimiter, type RateLimiter } from '../institution/rate-limit.ts';
import { createProductivityApi } from './http.ts';
import { PostgresProductivityRepository } from './postgres.ts';
import { ProductivityService, type Principal } from './service.ts';

export type ProductivityEnvironment = Record<string, string | undefined>;

/**
 * Whether the productivity service answers at all.
 *
 * Off unless `SEMESTER_PRODUCTIVITY=on`. Off, the function does not start and
 * every request gets the same 503 the institution gateway gives when it is
 * unconfigured: a deployment that has not chosen to run this has no endpoint
 * that behaves differently from a missing one.
 */
export function productivityEnabled(env: ProductivityEnvironment): boolean {
  return env.SEMESTER_PRODUCTIVITY === 'on';
}

/**
 * A verified school member, as the service's principal.
 *
 * `identity` is what the institution gateway's authenticator returns after it
 * has validated the token over the network and reloaded the person's current
 * tenant and roles from membership records. Nothing here is read from the
 * request. Two things are decided here and are worth saying plainly:
 *
 * - **A person with no school has no principal.** The authenticator resolves
 *   only SSO accounts that have an authorized provider and one active
 *   membership, so a personal (tenant `'self'`) account never reaches the
 *   service. Those accounts keep their tasks on `public.tasks`; this service's
 *   tables are tenant-scoped and a personal account has no tenant row to
 *   scope them to. D-1175 owns the move for them, if there is ever one.
 * - **`productivity:use` is granted to every active member of an enabled
 *   deployment.** The policy asks for it as an institution-level capability
 *   ("planning tools at this institution"), and there is no tenant capability
 *   table yet to read it from. The deployment switch is the only place it is
 *   decided; a per-tenant grant replaces this line, not the policy.
 */
export function principalFor(identity: UniversityIdentity, authenticatedAt: string): Principal {
  return {
    actor: { id: identity.userId, type: 'user', authenticatedAt },
    tenant: { id: identity.institutionId, environment: 'production', verifiedBy: 'membership' },
    membershipIds: [`${identity.institutionId}:${identity.userId}`],
    roleGrants: identity.roles.map((role) => ({ role, scopeKind: 'tenant', scopeId: identity.institutionId })),
    capabilities: ['productivity:use'],
    featureFlags: [],
    policyVersions: { productivity: '1' },
  };
}

const bearer = (request: Request): string | null => {
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get('authorization') ?? '');
  return match ? match[1]! : null;
};

/**
 * What failed, by class name only, and the ids that find it again: an error's message can quote a value, and
 * none of this service's logs carries content.
 */
function logError(source: 'service' | 'http', error: unknown, context: { correlationId: string; requestId?: string; route?: string }): void {
  console.error(JSON.stringify({
    event: 'productivity.error',
    source,
    name: error instanceof Error ? error.name : 'unknown',
    correlationId: context.correlationId,
    ...(context.requestId ? { requestId: context.requestId } : {}),
    ...(context.route ? { route: context.route } : {}),
  }));
}

/** One budget per kind of request on the gateway's shared limiter, under keys that cannot meet the gateway's own. */
const budget = (limiter: PostgresRateLimiter, kind: 'read' | 'write'): RateLimiter => ({
  allow: (who, now) => limiter.allow({ institutionId: who.institutionId, userId: `productivity.${kind}:${who.userId}` }, now),
});

/**
 * The service as a serverless function runs it: every mutable boundary is
 * Postgres, so nothing here is held in a process that the next request may
 * not reach. Reuses the institution gateway's credentials and its
 * authenticator, so there is one answer to "who is this" in the system.
 */
export function createProductionProductivityRuntime(env: ProductivityEnvironment): (request: Request) => Promise<Response> {
  if (!productivityEnabled(env)) throw new Error('Set SEMESTER_PRODUCTIVITY=on to run the productivity service.');
  const url = env.SEMESTER_AUTH_URL || '';
  const publicKey = env.SEMESTER_AUTH_PUBLIC_KEY || '';
  const serviceKey = env.SEMESTER_AUTH_SERVICE_KEY || '';
  if (!url || !publicKey || !serviceKey) {
    throw new Error('Production requires SEMESTER_AUTH_URL, SEMESTER_AUTH_PUBLIC_KEY and SEMESTER_AUTH_SERVICE_KEY.');
  }
  const resolve = createMembershipResolver(
    supabaseMembershipDirectory(url, serviceKey),
    async (event) => console.info(JSON.stringify({ event: 'institution.authorization', ...event })),
  );
  const identify = supabaseIdentity(url, publicKey, resolve);
  const service = new ProductivityService({
    repo: new PostgresProductivityRepository({ url, serviceKey }),
    onError: (error, context) => logError('service', error, context),
  });
  const read = new PostgresRateLimiter({ url, serviceKey, policy: { ...DEFAULT_RATE_LIMIT, max: 300 } });
  const write = new PostgresRateLimiter({ url, serviceKey, policy: { ...DEFAULT_RATE_LIMIT, max: 120 } });

  return createProductivityApi({
    service,
    authenticate: async (request) => {
      const token = bearer(request);
      const identity = token ? await identify(token) : null;
      return identity ? principalFor(identity, new Date().toISOString()) : null;
    },
    limiters: { read: budget(read, 'read'), write: budget(write, 'write') },
    basePath: '',
    telemetry: (event) => console.info(JSON.stringify({ event: 'productivity.request', ...event })),
    onError: (error, context) => logError('http', error, context),
  });
}
