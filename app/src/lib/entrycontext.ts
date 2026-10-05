import type { Screen } from './types';
import { linkedScreen } from './deeplink';

/**
 * Where somebody came from, and where they meant to go, when a link from
 * outside the app brings them in.
 *
 * A first-time visitor on a link used to lose the link. The store opens a new
 * install on onboarding before it looks at the address, so a campaign page's
 * "Open the registration view" arrived at the tour and, when the tour ended,
 * at the import screen — the page the visitor clicked on was gone. This module
 * is the half that reads the link; `afterSetup` in the store is the half that
 * keeps it through the tour.
 *
 * ## What a link may say
 *
 * Six short parameters, all optional:
 *
 *     src       where the click came from        (a fixed list)
 *     cid       a campaign id                    ([A-Za-z0-9_-], 64 at most)
 *     content   a content id                     (same)
 *     ref       a referral code                  (same)
 *     role      who the page believes this is    (a fixed list, a *hint*)
 *     continue  the screen to open afterwards    (`lib/deeplink.ts` allowlist)
 *
 * ## What a link may not do
 *
 * It cannot grant anything. `role` is a hint about which welcome to show and
 * is named `roleHint` so nobody reads it as a claim: a query string is typed
 * by whoever wrote the link, so who somebody is, which institution they
 * belong to and what they may open are decided by the signed-in account on the
 * server, never by this. `continue` is a screen *name* checked against the
 * same list `?screen=` uses, so it cannot be a URL, a path, a script, or a
 * screen that would strand a cold load. Anything outside the lists is dropped
 * rather than repaired, and the rest of the link still counts.
 *
 * Values that look like credentials — anything with a dot, a colon or a slash
 * in it, which is what a JWT, a URL and a path all have — fail the id pattern
 * and are dropped, so a token pasted into a campaign field is not stored.
 */

export const ENTRY_SOURCES = [
  'organic_search',
  'paid_campaign',
  'social',
  'youtube',
  'email',
  'referral',
  'institution_invite',
  'partner',
  'direct',
] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];

export const ROLE_HINTS = [
  'student',
  'applicant',
  'faculty',
  'advisor',
  'institution_admin',
  'institution_buyer',
  'guardian',
  'partner',
  'developer',
] as const;
export type RoleHint = (typeof ROLE_HINTS)[number];

export interface EntryContext {
  source: EntrySource;
  campaignId?: string;
  contentId?: string;
  referralCode?: string;
  /** Which welcome to show. Never what somebody may do. */
  roleHint?: RoleHint;
  /** A screen the app would open from `?screen=`; nothing else. */
  continueTo?: Screen;
}

export const ENTRY_KEY = 'semester.entry';

/** Long enough to finish signing up and verifying an email; short enough that a click from yesterday means nothing. */
export const ENTRY_MS = 30 * 60_000;

const ID = /^[A-Za-z0-9_-]{1,64}$/;

function id(value: string | null): string | undefined {
  return value !== null && ID.test(value) ? value : undefined;
}

function oneOf<T extends string>(list: readonly T[], value: string | null): T | undefined {
  return list.find((item) => item === value);
}

/**
 * What the address says, or null when it says nothing this module reads.
 *
 * `search` is `location.search`. A link with only `?screen=` is not an entry:
 * that is an installed app's shortcut, and `lib/deeplink.ts` handles it.
 */
export function parseEntry(search: string): EntryContext | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }
  const source = oneOf(ENTRY_SOURCES, params.get('src'));
  const campaignId = id(params.get('cid'));
  const contentId = id(params.get('content'));
  const referralCode = id(params.get('ref'));
  const roleHint = oneOf(ROLE_HINTS, params.get('role'));
  const asked = params.get('continue');
  const continueTo = (asked !== null && ID.test(asked) ? linkedScreen(asked, false) : null) ?? undefined;

  if (!source && !campaignId && !contentId && !referralCode && !roleHint && !continueTo) return null;
  return {
    source: source ?? 'direct',
    ...(campaignId && { campaignId }),
    ...(contentId && { contentId }),
    ...(referralCode && { referralCode }),
    ...(roleHint && { roleHint }),
    ...(continueTo && { continueTo }),
  };
}

/**
 * Kept for the tab, not the device: `sessionStorage`, so closing the tab ends
 * it, and a timestamp, so a tab left open does not carry it for hours.
 */
export function rememberEntry(entry: EntryContext, now = Date.now()): void {
  try {
    sessionStorage.setItem(ENTRY_KEY, JSON.stringify({ entry, at: now }));
  } catch {
    // Without storage the link still worked for this load; only the memory is lost.
  }
}

/** What was remembered and has not gone stale, re-validated on the way out. */
export function recallEntry(now = Date.now()): EntryContext | null {
  try {
    const raw = sessionStorage.getItem(ENTRY_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { entry?: Record<string, unknown>; at?: unknown };
    if (typeof saved.at !== 'number' || now - saved.at > ENTRY_MS || now < saved.at) return null;
    const e = saved.entry ?? {};
    const query = new URLSearchParams();
    if (typeof e.source === 'string') query.set('src', e.source);
    if (typeof e.campaignId === 'string') query.set('cid', e.campaignId);
    if (typeof e.contentId === 'string') query.set('content', e.contentId);
    if (typeof e.referralCode === 'string') query.set('ref', e.referralCode);
    if (typeof e.roleHint === 'string') query.set('role', e.roleHint);
    if (typeof e.continueTo === 'string') query.set('continue', e.continueTo);
    return parseEntry(query.toString());
  } catch {
    return null;
  }
}

export function forgetEntry(): void {
  try {
    sessionStorage.removeItem(ENTRY_KEY);
  } catch {
    // Nothing to forget.
  }
}

/**
 * The browser end: read the address, remember it, and say what it asked for.
 * Null when the address is not an entry, in which case an earlier one in this
 * tab (a refresh part-way through signing up) still counts.
 */
export function captureEntry(search: string, now = Date.now()): EntryContext | null {
  const fresh = parseEntry(search);
  if (fresh) {
    rememberEntry(fresh, now);
    return fresh;
  }
  return recallEntry(now);
}
