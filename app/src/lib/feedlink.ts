/**
 * The link somebody pastes, and how it becomes a calendar.
 *
 * `lib/ics.ts` reads the text. `lib/subscribe.ts` publishes one *out*. This is
 * the third side: taking whatever a student copied out of Brightspace, Outlook,
 * Google, iCloud or Canvas and turning it into an address this app can actually
 * fetch — then fetching it by whichever route works here.
 *
 * ## Why reading the link needs code at all
 *
 * Because nobody pastes a clean `https://…/basic.ics`. What arrives is
 * `webcal://`, or an address with no scheme because the copy button dropped it,
 * or a Google *embed* page with the calendar id buried in a query parameter, or
 * the whole thing wrapped in the angle brackets a mail client put round it.
 * Every one of those is the right calendar and the wrong string, and a screen
 * that answers all of them with "that did not work" is a screen that is wrong
 * about its own user. So the string is repaired where the repair is certain,
 * and refused with a reason where it is not.
 *
 * ## Why fetching needs two routes
 *
 * A calendar server sends no CORS headers, which means the page cannot read it
 * directly however correct the address is. The dev server forwards one request
 * for exactly this (`/feed?url=`, in `vite.config.ts`), and a deployment can
 * point `VITE_ICS_PROXY` at anything serving the same route.
 *
 * But neither route is the one that always works. Direct hits fail on
 * Brightspace and Outlook and succeed on the handful of hosts that do send the
 * header; the proxy is missing entirely from a static build that never had one
 * configured, and a single-page host answers `/feed?url=…` with **200 and its
 * own index.html**, which is the worst possible failure because it looks like
 * success. So both are tried, and what decides is not the status code but
 * whether what came back is a calendar — `BEGIN:VCALENDAR` or nothing.
 *
 * Direct goes first, and not only for speed: the token in a Brightspace or
 * Outlook feed URL is a password, and a route that does not need to hand it to
 * a proxy should not hand it to one.
 */

import type { FeedSource } from './types';

/** Where the forwarder lives. `/feed` is the dev server's own. */
const env = import.meta.env as unknown as Record<string, string | undefined>;
export const PROXY_PATH = env.VITE_ICS_PROXY ?? '/feed';

export interface FeedLink {
  /** The address to fetch: always `https:`, always repaired. */
  url: string;
  /** Which badge the connected list shows. */
  kind: FeedSource['kind'];
  /** What to call it before the calendar states its own name. */
  name: string;
}

/**
 * Who publishes calendars students paste, by hostname.
 *
 * Order matters: the first match wins, so the longer, more specific host
 * fragments come before the ones that would also catch them.
 */
const HOSTS: { has: RegExp; kind: FeedSource['kind']; name: string }[] = [
  { has: /(^|\.)brightspace\.|(^|\.)d2l\./i, kind: 'brightspace', name: 'Brightspace' },
  { has: /(^|\.)outlook\.(com|live\.com|office\.com|office365\.com)$/i, kind: 'microsoft', name: 'Outlook calendar' },
  { has: /(^|\.)(office365|office)\.com$/i, kind: 'microsoft', name: 'Outlook calendar' },
  { has: /(^|\.)calendar\.google\.com$/i, kind: 'ics', name: 'Google Calendar' },
  { has: /icloud\.com$/i, kind: 'ics', name: 'iCloud calendar' },
  { has: /(^|\.)instructure\.com$/i, kind: 'ics', name: 'Canvas' },
  { has: /(^|\.)zoom\.us$/i, kind: 'ics', name: 'Zoom' },
];

/** What a link from this host is, when it is somebody the app recognises. */
export function describeHost(host: string): { kind: FeedSource['kind']; name: string } {
  for (const h of HOSTS) if (h.has.test(host)) return { kind: h.kind, name: h.name };
  // Not a name the app knows, so it uses the host's own — better on the
  // connected list than a generic "Subscribed calendar" three of which are
  // indistinguishable.
  return { kind: 'ics', name: host.replace(/^www\./i, '') };
}

/**
 * A Google *embed* address turned into the feed behind it.
 *
 * `calendar.google.com/calendar/embed?src=…` is the address Google shows in a
 * browser and the one people copy. It is a web page, not a calendar, but the
 * calendar id is right there in `src=`, and the public feed for that id is a
 * fixed shape. Only the public one: the private "secret address" carries a key
 * this cannot invent, so a private calendar still has to be copied from
 * Google's own iCal-format link.
 */
function googleFeed(u: URL): URL | null {
  if (!/(^|\.)calendar\.google\.com$/i.test(u.hostname)) return null;
  if (!/\/calendar\/(embed|r|u\/\d+\/r)?\/?$/i.test(u.pathname)) return null;
  const src = u.searchParams.get('src') || u.searchParams.get('cid');
  if (!src) return null;
  return new URL(
    `https://calendar.google.com/calendar/ical/${encodeURIComponent(src)}/public/basic.ics`,
  );
}

/**
 * What was pasted, as something fetchable — or why it is not one.
 *
 * The repairs, all of them certain:
 *
 * - Surrounding whitespace, angle brackets and quotes, which is what a mail
 *   client or a chat app adds round a bare URL.
 * - `webcal:` and `webcals:`, which are `https` wearing a hat that makes a
 *   phone open its subscribe sheet. Apple, Outlook and half the campus systems
 *   hand these out.
 * - A missing scheme, when what is left still looks like a host.
 * - `http:`, upgraded — the page is served over https, so a plain-http fetch is
 *   blocked as mixed content before it leaves the browser, and every calendar
 *   host worth pasting redirects to https anyway.
 * - A Google embed page, as above.
 *
 * Everything else is refused with the reason, because a guess here produces a
 * request to somewhere the student did not name.
 */
export function readLink(input: string): { ok: true; link: FeedLink } | { ok: false; why: string } {
  const cleaned = input
    .trim()
    .replace(/^<+|>+$/g, '')
    .replace(/^["']|["']$/g, '')
    .trim();
  if (!cleaned) return { ok: false, why: 'Paste the calendar link first.' };

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned)?.[1]?.toLowerCase();
  let candidate = cleaned;
  if (scheme === 'webcal' || scheme === 'webcals') {
    candidate = cleaned.replace(/^webcals?:/i, 'https:');
  } else if (scheme === 'http') {
    candidate = cleaned.replace(/^http:/i, 'https:');
  } else if (!scheme) {
    // No scheme at all is the commonest paste of the lot. Only treat it as a
    // web address if it starts with something host-shaped.
    if (!/^[\w-]+(\.[\w-]+)+/.test(cleaned)) {
      return { ok: false, why: 'That does not look like a web address. It should start with https:// or webcal://.' };
    }
    candidate = `https://${cleaned}`;
  } else if (scheme !== 'https') {
    return {
      ok: false,
      why: `The app can only read https and webcal links, and that one is ${scheme}:.`,
    };
  }

  let u: URL;
  try {
    u = new URL(candidate);
  } catch {
    return { ok: false, why: 'That link could not be read as a web address. Copy it again from the calendar.' };
  }
  if (!u.hostname.includes('.')) {
    return { ok: false, why: 'That link has no host in it. Copy the whole address, including the part after https://.' };
  }

  u = googleFeed(u) ?? u;
  const { kind, name } = describeHost(u.hostname);
  return { ok: true, link: { url: u.toString(), kind, name } };
}

/** Whether some text is actually an iCalendar file. */
export function isCalendar(text: string): boolean {
  return /BEGIN:VCALENDAR/i.test(text.slice(0, 4096));
}

/**
 * Why what came back is not a calendar, said in terms of what to do next.
 *
 * The two answers a wrong link actually gives are a sign-in page and an error
 * page, and both are HTML. Telling somebody "no events" for either is telling
 * them the calendar is empty when the calendar was never reached.
 */
export function notCalendar(text: string): string {
  const head = text.trimStart().slice(0, 400).toLowerCase();
  if (head.startsWith('<') || head.includes('<html')) {
    return 'That address answered with a web page rather than a calendar — usually a sign-in screen, which means the link is the one you open in a browser rather than the feed. In Brightspace it is Calendar → Subscribe; in Outlook it is Settings → Calendar → Shared calendars → Publish, then the ICS link; in Google it is the calendar’s settings → Secret address in iCal format.';
  }
  if (!text.trim()) return 'That address answered with nothing at all. Check the link, or download the .ics and add the file.';
  return 'That address answered with something that is not a calendar. The link has to be the .ics or webcal one, not the page you read the calendar on.';
}

/** The forwarder's address for one calendar. */
export function proxied(url: string): string {
  return `${PROXY_PATH}?url=${encodeURIComponent(url)}`;
}

export interface Fetched {
  text: string;
  /** Which route answered, so a caller can say what was needed. */
  via: 'direct' | 'proxy' | 'account';
}

export interface Routes {
  /** Swapped in tests. Everything else uses the browser's own. */
  fetcher?: typeof fetch;
  /**
   * The account's forwarder — `fetchIcsVia` in `lib/cloud.ts`, passed in rather
   * than imported so this module stays free of the Supabase client and its
   * whole dependency tree.
   */
  account?: (url: string) => Promise<string>;
}

/**
 * The calendar behind a link, by whichever route this build has.
 *
 * Three, tried in order of how little each needs to be true:
 *
 * 1. **Direct.** Works only where the calendar host allows a web page to read
 *    it, which is a minority — but it is one hop and nothing else sees the
 *    token, so it is worth asking.
 * 2. **The dev server**, or whatever `VITE_ICS_PROXY` points at. Present while
 *    developing, absent from a static build.
 * 3. **The account**, which is the one that works on a deployed app — the
 *    `fetchcal` Edge Function, and it needs somebody signed in.
 *
 * A route "works" only if what it returns is a calendar. A single-page host
 * answers an unknown path with its own index.html and a **200**, and treating
 * that as success is how somebody ends up with an empty calendar and no idea
 * why.
 *
 * Throws with the most useful of the failures rather than the last one: a
 * forwarder that is not there says nothing worth reading, where the direct
 * attempt at least says the feed refused the browser.
 */
export async function fetchCalendar(url: string, routes: Routes = {}): Promise<Fetched> {
  const fetcher = routes.fetcher ?? fetch;
  let best = '';

  const over = async (at: string): Promise<{ text: string } | { why: string; quiet?: boolean }> => {
    try {
      const res = await fetcher(at, { redirect: 'follow' });
      const text = await res.text();
      if (res.ok && isCalendar(text)) return { text };
      // 404 on the forwarder's path is a build without one, which is not worth
      // reporting over whatever the calendar itself said.
      if (!res.ok) return { why: `The calendar answered ${res.status}.`, quiet: res.status === 404 };
      return { why: notCalendar(text) };
    } catch {
      // A CORS refusal and an unreachable host are the same TypeError here, so
      // the message covers both rather than picking one.
      return {
        why: 'The browser could not reach that calendar directly — most calendar servers refuse to be read by a web page.',
      };
    }
  };

  const direct = await over(url);
  if ('text' in direct) return { text: direct.text, via: 'direct' };
  best ||= direct.why;

  const proxy = await over(proxied(url));
  if ('text' in proxy) return { text: proxy.text, via: 'proxy' };
  if (!proxy.quiet) best ||= proxy.why;

  if (routes.account) {
    try {
      const text = await routes.account(url);
      if (isCalendar(text)) return { text, via: 'account' };
      best = notCalendar(text);
    } catch (e) {
      // The function's own refusal is the most specific thing anybody will see
      // — it knows whether the address was rejected, the session was stale or
      // the calendar answered a sign-in page — so it replaces what came before.
      const said = e instanceof Error ? e.message : '';
      if (said && said !== 'Signed out.') best = said;
    }
  }

  throw new Error(`${best} Downloading the .ics from the same place and adding the file works either way.`);
}
