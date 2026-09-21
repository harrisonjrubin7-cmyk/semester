/**
 * Is this load the far end of a Brightspace launch?
 *
 * A leaf, deliberately, and it holds nothing but the question, the answer's
 * shape, and the cleaning of the address bar. **It imports nothing**, and
 * `ltiarrival.test.ts` fails if that stops being true.
 *
 * `lib/redirected.ts` is the same shape for the same reason, and its header
 * records what the reason cost. `completeAuth()` in `lib/connect.ts` could
 * always answer "no redirect here" immediately, but the module around it had
 * to be downloaded and evaluated to say so — 1,616 lines of provider specs,
 * PKCE and token exchange in front of the first render, for everybody, in
 * order to read two query parameters. See `ENGINEERING-AUDIT.md` §1.
 *
 * `lib/ltilanding.ts` is this module's heavy half: it reaches `lib/cloud.ts`
 * to mint a session and to call `adopt_lti_identity`. Asking *there* whether
 * this is a launch would put the whole Supabase client on every cold start, to
 * decide — on every load but one in a student's term — that there was nothing
 * to do. So the question lives here and `main.tsx` reaches for the other half
 * through `import()` only on the load that is actually a launch.
 */

/** What a validated launch handed over in the address bar. */
export interface Handoff {
  /** The one-use token a session is established from. */
  token: string;
  /** The address it was minted for. */
  email: string;
  /**
   * Present only when this launch created the account, and so only when there
   * is something to adopt. A returning student gets none: their identity is
   * already bound, and a live proof sitting in their history buys nothing.
   */
  ticket: string | null;
}

/** Where the ticket waits for the Connect screen, if there is one. */
export const TICKET_KEY = 'semester.lti.ticket';

/**
 * Read the handoff out of a query string, or null.
 *
 * Null for anything short of both halves. A token with no address cannot mint
 * a session and an address with no token is just an address, so a partial
 * handoff is treated as no handoff rather than as an error — and the ordinary
 * way to arrive here is with neither, by opening the app normally.
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

/**
 * Take the handoff off the address bar, and hand back what was on it.
 *
 * **The cleaning happens here and unconditionally**, before the caller does
 * anything with the token, because the failure that matters is the one where
 * consuming it throws and the address stays in the bar with a live token in
 * it. A one-use token is still a token: it sits in history, in the back
 * button, and in whatever a student pastes into a group chat when they say
 * "this is the link".
 *
 * `takeFromUrl()` in `lib/referral.ts` does the same job for a referral code
 * and swallows a `replaceState` failure the same way — a stale parameter is
 * untidy, and refusing to continue over it would cost the student the launch.
 */
export function takeHandoff(): Handoff | null {
  if (typeof window === 'undefined') return null;
  const found = readHandoff(window.location.search);
  if (!found) return null;

  try {
    window.history.replaceState(null, '', stripped(window.location.href));
  } catch {
    // Untidy rather than wrong: the values are already in hand.
  }

  /*
   * The ticket outlives this function because the screen that offers "I
   * already have an account" is not this load's first render — the student has
   * to get to Connect. Session storage rather than local: it belongs to this
   * tab and this arrival, and a ticket that survived a browser restart would
   * be a proof of a launch that happened yesterday.
   */
  if (found.ticket) {
    try {
      sessionStorage.setItem(TICKET_KEY, found.ticket);
    } catch {
      // Private mode, or storage refused. The launch still works; only the
      // offer to attach an existing account is lost, and it can be had again
      // by launching from Brightspace a second time.
    }
  }

  return found;
}

/** The ticket this arrival left, if any. Read by the Connect screen. */
export function heldTicket(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(TICKET_KEY) || null;
  } catch {
    return null;
  }
}

/** Forget it, once it has been spent or refused for good. */
export function forgetTicket(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(TICKET_KEY);
  } catch {
    // Nothing depends on it: a spent ticket is refused by the database anyway.
  }
}
