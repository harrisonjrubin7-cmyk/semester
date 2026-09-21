/**
 * What account a launch opens — the rules half, with no I/O.
 *
 * `_shared/lti.ts` answers "is this launch real". This answers the question
 * that comes immediately after and is the one with the sharp edge on it:
 * **which Semester account does a real launch open, and what is that account
 * made of.**
 *
 * Same shape and for the same reason — arguments in, verdict out, no
 * `Deno.env`, so `app/src/lib/ltiaccount.test.ts` can walk it.
 *
 * ## The email claim is never used to find an account, and the schema is what
 * guarantees that rather than this file's good intentions
 *
 * The tempting design reads `email` off the token, finds the account with that
 * address, and signs the student in. It is account takeover with extra steps:
 * an email claim is a string a registered platform sends us, so anything that
 * matches on it hands an existing account to whoever can get one registration
 * row wrong or one platform compromised.
 *
 * Refusing to *write* that code is not enough, because the next person to
 * touch it has to know. So a provisioned account's address is **synthesised
 * from the issuer and subject and is never the claimed one**, and that makes
 * the property structural:
 *
 *  - It cannot collide with a real address, so there is no account for an
 *    email match to find even if somebody later writes one.
 *  - It cannot collide with *another* provisioned account, because the digest
 *    covers both issuer and subject.
 *  - It is on a reserved domain (RFC 2606 `.invalid`), which no one can
 *    receive mail at — so nobody can be sent a password reset for an account
 *    they did not make, and the address cannot quietly become a login.
 *
 * The claimed address and name still travel, into `user_metadata`, where they
 * are display and never identity. `20260921160100_lti_identity.sql` is the
 * other half: attaching an account somebody already had needs a ticket *and* a
 * session, and reads no email at all.
 */

import type { Launch } from './lti.ts';

/**
 * Reserved by RFC 2606 and guaranteed never to resolve. The point is not
 * tidiness: it is that an address here can never be a mailbox, so a
 * provisioned account can never be recovered into by email.
 */
const NOWHERE = 'lti.invalid';

/**
 * The address a provisioned account is created with.
 *
 * Deterministic, so a second launch by the same person at the same school
 * lands on the same address — which matters because the account lookup goes
 * through `lti_identity`, and an address that drifted would leave orphans
 * behind every time a row was lost.
 *
 * Hashed rather than spelled out, because a subject is an opaque id the
 * platform chose and some platforms choose the student's username. Putting
 * that in an address turns a table nobody can read into one that leaks a
 * roster the moment it is printed in a log.
 */
export async function provisionedEmail(issuer: string, subject: string): Promise<string> {
  /*
   * A separator that cannot appear in either half, so ("a|b", "c") and
   * ("a", "b|c") cannot hash alike. Issuers are URLs and subjects are opaque,
   * and neither may contain a NUL.
   */
  const bytes = new TextEncoder().encode(`${issuer}\u0000${subject}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `lti-${hex.slice(0, 32)}@${NOWHERE}`;
}

/** True for an address this file minted. Used to tell a provisioned account apart. */
export function isProvisionedEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && /^lti-[0-9a-f]{32}@lti\.invalid$/.test(email);
}

/**
 * What a provisioned account carries about the person, and where.
 *
 * `user_metadata` and not `app_metadata`, deliberately, and the difference is
 * the one `app/server/institution/auth.ts` turns on: `user_metadata` is
 * writable by the signed-in user and is therefore **never** trusted for a
 * grant. That is exactly right for a display name — and exactly why the LTI
 * facts that decide anything live in `lti_identity`, a table no client can
 * read or write, instead of here.
 */
export function provisionedMetadata(who: Launch): Record<string, unknown> {
  return {
    // Prefixed so nothing reads these as Semester's own idea of a person.
    lti_name: who.name ?? null,
    // Kept for display and for a human doing support. Never matched on.
    lti_email: who.email ?? null,
    lti_issuer: who.issuer,
    lti_context: who.contextTitle ?? null,
    lti_teaches: who.teaches,
  };
}

/**
 * Where a launch should land in the app once there is a session.
 *
 * A course when the platform named one, and the app's front door when it did
 * not. `target_link_uri` is not used for this: it has already been checked to
 * be on our origin, but it points at the *launch endpoint*, not at a screen,
 * and following it would put the student back through the handshake.
 */
export function landingPath(who: Launch): string {
  return who.contextId ? `#/courses?lti=${encodeURIComponent(who.contextId)}` : '#/today';
}
