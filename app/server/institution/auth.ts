import { createClient } from '@supabase/supabase-js';
import {
  UNIVERSITY_ROLES,
  type UniversityIdentity,
  type UniversityRole,
} from '../../../packages/institution/src/index.ts';

/**
 * Who the gateway believes is asking, and why it believes it.
 *
 * Two rules, and everything downstream depends on both.
 *
 * ## The token is validated over the network
 *
 * Not decoded. A JWT read locally tells you what somebody put in a JWT, and
 * verifying its signature only proves it was issued — not that it has not
 * since been revoked, that the account still exists, or that the session was
 * not signed out an hour ago. `getUser` asks the auth service, every time, and
 * that round trip is the price of the answer being current.
 *
 * ## Roles come from `app_metadata`, which no client can write
 *
 * Supabase exposes two metadata bags on a user. `user_metadata` is writable by
 * the signed-in user — anybody can put `{"roles":["admin"]}` in their own. It
 * is never read here. `app_metadata` is writable only by a service-role key
 * held by the school's own systems, which makes it the one place a grant can
 * be recorded that the grantee cannot forge.
 *
 * So a university role in this app has exactly one source: a school
 * administrator setting `app_metadata.semester` on an account. The role
 * selector on `screens/University.tsx` picks a draft template and can never
 * reach this file — the two are separate fields with separate names in
 * `@semester/institution` precisely so nothing can confuse them.
 */

interface SemesterGrant {
  institutionId?: unknown;
  roles?: unknown;
}

/**
 * An identity from a verified user record, or null.
 *
 * Null for anything short of a complete grant: no `app_metadata.semester`, no
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
export function supabaseIdentity(url: string, key: string) {
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return async (token: string): Promise<UniversityIdentity | null> => {
    const { data, error } = await client.auth.getUser(token);
    return error || !data.user ? null : trustedIdentity(data.user);
  };
}
