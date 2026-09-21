/**
 * Landing in the app after Brightspace launched it.
 *
 * `supabase/functions/lti/index.ts` ends a good launch by redirecting here
 * with three values in the query string: a one-use session token, the address
 * it was minted for, and — only when this launch is what created the account —
 * a ticket for saying "I already have a Semester account".
 *
 * This module is the other end of that. The parsing is pure so it can be
 * tested; the two functions that touch the network are thin and say what they
 * do.
 *
 * ## The address bar is cleaned before anything else happens
 *
 * A one-use token is still a token, and a URL lives in history, in the back
 * button, in whatever the student pastes into a group chat when they say "this
 * is the link". `strip()` runs first and unconditionally — before the token is
 * spent, not after — because the failure that matters is the one where
 * consuming it throws and the address stays in the bar with the token still in
 * it.
 *
 * ## Why the query string and not the fragment
 *
 * This app keeps its own routes in the fragment (`#/today`), so the handoff
 * would be fighting the router for the same space. The query string is read
 * once, here, and removed.
 */

import { cloud } from './cloud';

/** What the launch handed over, when it handed anything over. */
export interface Handoff {
  /** The one-use token a session is established from. */
  token: string;
  /** The address it was minted for. */
  email: string;
  /**
   * Present only when this launch created the account, and so only when there
   * is something to adopt. A returning student gets none, because their
   * identity is already bound and a live proof in their history buys nothing.
   */
  ticket: string | null;
}

/**
 * Read the handoff out of a query string, or null.
 *
 * Null for anything short of both halves. A token with no address cannot mint
 * a session and an address with no token is just an address, so a partial
 * handoff is treated as no handoff rather than as an error — the ordinary way
 * to arrive here is with neither, by opening the app normally.
 */
export function readHandoff(search: string): Handoff | null {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const token = (q.get('lti_token') ?? '').trim();
  const email = (q.get('lti_email') ?? '').trim();
  if (!token || !email) return null;
  const ticket = (q.get('lti_ticket') ?? '').trim();
  return { token, email, ticket: ticket || null };
}

/** The same address with every handoff parameter removed, fragment intact. */
export function stripped(href: string): string {
  const url = new URL(href);
  for (const k of ['lti_token', 'lti_email', 'lti_ticket']) url.searchParams.delete(k);
  /*
   * `URL` leaves a bare `?` behind when the last parameter goes, which is
   * harmless and looks broken. Removing it is the difference between an
   * address a student would paste and one they would ask about.
   */
  return url.search === '' ? url.toString().replace(/\?(?=#|$)/, '') : url.toString();
}

/** What `adopt` can come back with. The words are the database's. */
export type Adopted = 'ok' | 'signed-out' | 'stale' | 'same-account' | 'in-use' | 'failed';

/**
 * One sentence a person reads, for each word the database returns.
 *
 * The division `claim_referral` and the invite gate both draw: the database
 * answers with a word for a log, and turning it into English is the client's
 * job. Keeping the sentences here rather than in a screen means the two places
 * that will eventually show this cannot drift apart.
 */
export function saidAbout(what: Adopted): string {
  switch (what) {
    case 'ok':
      return 'Connected. Opening Semester from Brightspace will use your own account from now on.';
    case 'signed-out':
      return 'Sign in to the Semester account you already have, then try again.';
    case 'stale':
      return 'That link has expired. Open Semester from Brightspace again to start over.';
    case 'same-account':
      return 'This is already your account — there is nothing to connect.';
    case 'in-use':
      /*
       * The one refusal that is not the student doing anything wrong, and the
       * only one that needs a person. Saying "contact us" beats implying they
       * can fix it by trying harder.
       */
      return 'The account Brightspace made for you already has work in it, so connecting would mean merging two accounts. Get in touch and we will do it by hand.';
    default:
      return 'Something went wrong connecting your account. Nothing was changed.';
  }
}

/**
 * Establish the session the launch minted.
 *
 * `verifyOtp` with the token hash, which is what `generateLink` produced on
 * the server. This is the only place in the app a session arrives from
 * anywhere but a sign-in form or an OAuth round trip.
 */
export async function consume(handoff: Handoff): Promise<boolean> {
  const db = await cloud();
  const { error } = await db.auth.verifyOtp({
    token_hash: handoff.token,
    type: 'magiclink',
  });
  if (error) {
    console.error(`lti landing: could not establish the session — ${error.message}`);
    return false;
  }
  return true;
}

/**
 * Attach this launch to the account the student is signed in to.
 *
 * Called while signed in as the account they already had — which is the half
 * of the proof this side holds. The other half is the ticket, which only the
 * server could have minted. `adopt_lti_identity` is the only function in this
 * schema a signed-in account may call for a reason, and the reason is this.
 */
export async function adopt(ticket: string): Promise<Adopted> {
  const db = await cloud();
  const { data, error } = await db.rpc('adopt_lti_identity', { want_ticket: ticket });
  if (error) {
    console.error(`lti adopt failed: ${error.message}`);
    return 'failed';
  }
  return (data as Adopted) ?? 'failed';
}
