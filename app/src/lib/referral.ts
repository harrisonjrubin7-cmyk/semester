/**
 * The link a student hands a classmate, and the only two numbers it produces.
 *
 * An ambassador gets a link. Somebody who arrives through it and makes an
 * account is counted against it. The ambassador sees how many people came in,
 * and how many of them are still here. That is the whole feature; the plan it
 * comes from is explicit that the paying half is not to be built until two or
 * three real ambassadors have been tracked by hand off exactly these numbers.
 *
 * Almost all of the design is in `supabase/migrations/20260921003500_referrals.sql`,
 * because almost all of it is about what one account may learn about another
 * and that can only be settled in the database. This module is the browser's
 * half: getting a code out of a URL, keeping it across the round trip that
 * making an account involves, and turning a one-word answer into a sentence.
 *
 * ## What a code is worth, and why it is not treated as a secret
 *
 * A referral link is made to be posted in a group chat. It is not a
 * credential: the worst thing somebody can do with a code that is not theirs
 * is give another student credit for their own sign-up. So there is no
 * rotation and no expiry, and the code sits in a URL where it is visible —
 * unlike the calendar token in `lib/cloud.ts`, which is a bearer credential and
 * is handled quite differently. Getting that distinction the wrong way round
 * in either direction is how this sort of thing goes wrong.
 *
 * The one thing that is treated carefully is the other direction: a code in
 * the address bar is a code that survives into a screenshot, a bookmark and a
 * shared tab, so `takeFromUrl` removes it the moment it has been read.
 *
 * ## The round trip this has to survive
 *
 * Between opening a link and having an account there is, depending on the
 * route: a form, an email with a confirmation link that opens in a *different
 * tab*, and — for Google, Microsoft or Apple — a redirect out to a provider
 * and back to a URL this app did not compose. The query string does not
 * survive any of those. So the code is written to localStorage on arrival and
 * claimed later, when a session actually appears, which may be minutes later
 * and in another tab on the same device.
 *
 * That is also why the claim is not part of sign-up: there is no single moment
 * in this app where an account is made. `state/store.tsx` already watches for
 * a session arriving *however* it arrived, and that is the hook.
 */

import { appUrl, cloud, cloudConfigured } from './cloud';

/**
 * The two figures that also live in the migration, and cannot be imported
 * from it. `referral.test.ts` reads that file as text and fails if either side
 * moves — the instrument `lib/allowance.test.ts` uses on the Edge Function's
 * monthly limit, for the same reason: each side is correct on its own and no
 * unit test of either can see the gap.
 */
export const ACTIVE_DAYS = 14;
export const NEW_DAYS = 7;

/** The query parameter a link carries. */
export const REFERRAL_PARAM = 'r';

/** Where a code waits between arriving and there being an account to attach it to. */
export const PENDING_KEY = 'semester.referral.v1';

/** Where the answer waits between the claim and the screen that reports it. */
export const SAID_KEY = 'semester.referral.said.v1';

/**
 * The shape the database will accept, restated here so a malformed code costs
 * nothing rather than a round trip. No 0, O, 1, I, L or U — the first five are
 * the pairs people mistype reading a code off a phone screen, and U is out so
 * that a generated code cannot spell anything.
 */
export const CODE_SHAPE = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}$/;

/** What the database answers a claim with. */
export type Claim = 'ok' | 'self' | 'already' | 'late' | 'unknown' | 'signed-out';

/** Upper case, no surrounding space — what a code looks like once stored. */
export function tidyCode(raw: string): string {
  return (raw ?? '').trim().toUpperCase();
}

/**
 * The code in a URL, from either of the two places it can be.
 *
 * This app routes on the hash — `#/import`, `#/grades` — so a link can
 * reasonably be written either way, and both turn up in practice: the app's
 * own share button composes `?r=CODE` before the hash, and a student who
 * copies the address bar mid-session and edits it by hand produces
 * `#/account?r=CODE`. Reading only the first would silently drop the second,
 * and the failure would look like the referral simply not counting.
 */
export function readCode(search: string, hash = ''): string {
  const from = (qs: string): string => {
    try {
      return tidyCode(new URLSearchParams(qs).get(REFERRAL_PARAM) ?? '');
    } catch {
      return '';
    }
  };
  const plain = from(search.startsWith('?') ? search.slice(1) : search);
  if (CODE_SHAPE.test(plain)) return plain;
  const q = hash.indexOf('?');
  const inHash = q === -1 ? '' : from(hash.slice(q + 1));
  return CODE_SHAPE.test(inHash) ? inHash : '';
}

/** The link an ambassador copies. */
export function linkFor(code: string, base?: string): string {
  const root = base ?? appUrl();
  const url = new URL(root);
  url.searchParams.set(REFERRAL_PARAM, tidyCode(code));
  return url.href;
}

const remember = (key: string, value: string): void => {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // A private window, or storage that is full. The referral is the least
    // important thing on the device and it is not worth an error anywhere.
  }
};

const recall = (key: string): string => {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

/** A code waiting for an account. */
export function pendingCode(): string {
  const held = tidyCode(recall(PENDING_KEY));
  return CODE_SHAPE.test(held) ? held : '';
}

export function forgetCode(): void {
  remember(PENDING_KEY, '');
}

/**
 * Take the code out of the address bar and keep it.
 *
 * Removing it is the point of doing this on arrival rather than reading the
 * URL when it is needed. A code left in the address bar is copied with the
 * address — into a screenshot, a bookmark, a message saying "look at this
 * page" — and every one of those is somebody being credited to an ambassador
 * they have never met.
 *
 * An existing pending code is not overwritten. Somebody who opened one
 * classmate's link on Tuesday and another's on Thursday was brought here by
 * the first, and "last link wins" would quietly hand the credit to whoever
 * messaged most recently.
 */
export function takeFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const found = readCode(window.location.search, window.location.hash);
  const held = pendingCode();
  if (found && !held) remember(PENDING_KEY, found);
  if (found) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete(REFERRAL_PARAM);
      window.history.replaceState(null, '', url.href);
    } catch {
      // Nothing to do about it, and nothing depends on it: the code is
      // already kept, and a stale parameter is untidy rather than wrong.
    }
  }
  return held || found;
}

/**
 * What to tell the person who arrived on the link.
 *
 * Only one of the six answers produces a sentence, and that is the point.
 * `ok` means a row was written that associates this account with somebody
 * else's code, and an app whose privacy page makes a good deal of how little
 * it keeps should say so the once rather than let it be a thing the student
 * would have to read the schema to discover. The other five wrote nothing, so
 * there is nothing to disclose and a notice about them would be noise.
 *
 * It also does not name the ambassador, because this side cannot know it —
 * `claim_referral` deliberately never answers with who owns a code.
 */
export function sayClaim(word: string): string {
  return word === 'ok'
    ? 'You came in on a classmate’s invite link. Your account is counted on it — ' +
        'a number only, never your name or anything you do here.'
    : '';
}

/** The sentence the claim left behind, read once and cleared. */
export function takeClaimSaid(): string {
  const said = sayClaim(recall(SAID_KEY));
  remember(SAID_KEY, '');
  return said;
}

/**
 * Hand a waiting code to the database, once there is an account to hand it for.
 *
 * Returns '' when there was nothing to do, which is the overwhelmingly common
 * case — so the check is a localStorage read and not a request.
 *
 * A thrown error leaves the code pending on purpose: the two ways this fails
 * are a flaky connection and being offline, both of which are answered by
 * trying again at the next sign-in. Every *answer*, including the refusals,
 * clears it — 'late' and 'already' will not become 'ok' by being asked twice,
 * and a device that retried them forever would send a request on every sign-in
 * for the life of the account.
 */
export async function claimPending(): Promise<Claim | ''> {
  const code = pendingCode();
  if (!code || !cloudConfigured) return '';
  const { data, error } = await (await cloud()).rpc('claim_referral', { given: code });
  if (error) throw new Error(error.message);
  const word = (typeof data === 'string' ? data : '') as Claim;
  forgetCode();
  if (word === 'ok') remember(SAID_KEY, word);
  return word;
}

/** How an ambassador's link is doing. */
export interface Standing {
  /** Their code, or '' if they have never asked for one. */
  code: string;
  /** Accounts made through the link. */
  joined: number;
  /** How many of those synced inside the last `ACTIVE_DAYS` days. */
  active: number;
  /**
   * Whether an account can be created at all right now.
   *
   * False while the pilot's invite gate is on, and then the link cannot work
   * for anybody not already on the list. A screen that did not know this would
   * print a dead link under a cheerful heading.
   */
  signupOpen: boolean;
}

const standingOf = (row: Record<string, unknown> | null): Standing => ({
  code: typeof row?.code === 'string' ? row.code : '',
  joined: Number(row?.joined ?? 0),
  active: Number(row?.active ?? 0),
  signupOpen: row?.signup_open !== false,
});

/** Read the standing. Null when there is no account service at all. */
export async function standing(): Promise<Standing | null> {
  if (!cloudConfigured) return null;
  const { data, error } = await (await cloud()).rpc('referral_standing');
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
  return standingOf(row as Record<string, unknown> | null);
}

/** Ask for a code, making one the first time. */
export async function makeCode(): Promise<string> {
  const { data, error } = await (await cloud()).rpc('make_referral_code');
  if (error) throw new Error(error.message);
  return typeof data === 'string' ? data : '';
}

/**
 * The line under the two numbers.
 *
 * Written from the numbers rather than kept as four fixed strings because the
 * interesting case is the one a fixed string gets wrong: nought active out of
 * nought joined is a link nobody has used, and nought active out of nine is a
 * different thing entirely and the one an ambassador needs to see.
 */
export function standingSaid(s: Standing): string {
  if (!s.signupOpen) {
    return (
      'Your link cannot make an account yet. Semester is invite-only while it is being ' +
      'piloted, so anyone you send it to has to be on the invite list as well.'
    );
  }
  if (s.joined === 0) return 'Nobody has joined on your link yet.';
  const joined = `${s.joined} ${s.joined === 1 ? 'person has' : 'people have'} joined on your link`;
  if (s.active === 0) {
    return `${joined}, and none has synced in the last ${ACTIVE_DAYS} days.`;
  }
  if (s.active === s.joined) {
    return `${joined}, and ${s.joined === 1 ? 'they have' : 'all of them have'} synced in the last ${ACTIVE_DAYS} days.`;
  }
  return `${joined}. ${s.active} of them synced in the last ${ACTIVE_DAYS} days.`;
}
