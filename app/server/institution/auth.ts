import { createClient } from '@supabase/supabase-js';
import {
  UNIVERSITY_ROLES,
  type UniversityIdentity,
  type UniversityRole,
} from '../../../packages/institution/src/index.ts';
import type { MembershipResolver, VerifiedAuthUser, VerifiedMembershipIdentity } from './membership.ts';

/**
 * Who the gateway believes is asking, and why it believes it.
 *
 * Two rules, and everything downstream depends on both.
 *
 * ## The token is validated over the network
 *
 * Identity and authorization are never decoded from the token. `getUser` asks
 * the auth service, every time, so a revoked token, deleted account or signed-
 * out session stops working at once. Only after that service validates the
 * exact token do we decode its signed `exp` claim, solely to cap the active
 * context at the same session boundary.
 *
 * ## Institutional roles come from current membership records
 *
 * The validated Auth user contributes only its id and server-issued SSO
 * provider identifier. `membership.ts` then resolves one authorized provider
 * and one active membership from Postgres. Neither `user_metadata` nor stale
 * `app_metadata.semester` role claims participate in production authorization.
 */

interface SemesterGrant {
  institutionId?: unknown;
  roles?: unknown;
}

/**
 * A legacy fixture identity from server-only app metadata, or null.
 *
 * Local tests and the sandbox use this helper while they do not have a
 * Supabase project. Production startup requires the resolver below. Null for
 * anything short of a complete grant: no `app_metadata.semester`, no
 * institution, no recognised role. The gateway turns null into a 403 saying
 * no verified access is assigned — which is the true state of every account
 * until a school assigns one.
 *
 * Unknown role strings are filtered rather than rejected, so a school adding a
 * role this build has not heard of does not lock out its students; but an
 * account left with *no* recognised role is not an identity, because there
 * would be nothing to authorize.
 */
export function trustedIdentity(user: {
  id: string;
  app_metadata?: Record<string, unknown>;
}): UniversityIdentity | null {
  const grants = user.app_metadata?.semester as SemesterGrant | undefined;
  if (!grants || typeof grants.institutionId !== 'string' || !grants.institutionId.trim()) return null;
  if (!Array.isArray(grants.roles)) return null;

  const roles = grants.roles.filter((role): role is UniversityRole =>
    UNIVERSITY_ROLES.includes(role as UniversityRole),
  );
  return roles.length ? { userId: user.id, institutionId: grants.institutionId, roles } : null;
}

/**
 * A token checker bound to one auth project.
 *
 * The client is built without session persistence, auto-refresh or URL
 * detection: this is a server asking about somebody else's token, and every
 * one of those features exists to manage a session of one's own. Left on,
 * they would have the gateway quietly holding and refreshing a student's
 * credentials.
 */
interface SupabaseAuthClient {
  auth: {
    getUser(token: string): Promise<{
      data: { user: { id: string; email?: string; app_metadata?: Record<string, unknown> } | null };
      error: unknown;
    }>;
  };
}

export function verifiedAuthUser(user: {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
}, sessionExpiresAt: string): VerifiedAuthUser | null {
  const provider = user.app_metadata?.provider;
  const userName = user.email?.trim().toLowerCase();
  return typeof provider === 'string' && provider.startsWith('sso:') && userName
    ? { id: user.id, providerIdentifier: provider, userName, sessionExpiresAt }
    : null;
}

const sessionExpiry = (token: string, nowMs: number): string | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { exp?: unknown };
    if (!Number.isSafeInteger(payload.exp)) return null;
    const expiresMs = (payload.exp as number) * 1000;
    if (!Number.isSafeInteger(expiresMs) || expiresMs <= nowMs || expiresMs > 8_640_000_000_000_000) return null;
    return new Date(expiresMs).toISOString();
  } catch {
    return null;
  }
};

export function identityFromSupabaseClient(
  client: SupabaseAuthClient,
  resolve: MembershipResolver,
  nowMs: () => number = Date.now,
) {
  return async (token: string): Promise<VerifiedMembershipIdentity | null> => {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    const expiresAt = sessionExpiry(token, nowMs());
    if (!expiresAt) return null;
    const user = verifiedAuthUser(data.user, expiresAt);
    return user ? resolve(user) : null;
  };
}

export function supabaseIdentity(url: string, key: string, resolve: MembershipResolver) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return identityFromSupabaseClient(client, resolve);
}
