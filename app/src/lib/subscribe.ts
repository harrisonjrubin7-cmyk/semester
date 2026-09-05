/**
 * A calendar your calendar app follows, rather than a file you import once.
 *
 * `lib/export.ts` writes the `.ics`. This is the other half of the same idea:
 * a URL that serves it, so a deadline moved in the app moves on the lock
 * screen a few hours later without anybody re-importing anything. The file and
 * the feed are genuinely different things and the app should never let the two
 * be confused — a downloaded file is a photograph, a feed is a window.
 *
 * (`lib/feed.ts` is something else entirely: the order of the sections on
 * Today. This one is about calendars.)
 *
 * ## Why the app renders it and the server only serves it
 *
 * The obvious design is an Edge Function that reads the account's courses out
 * of the database and works out the deadlines. That means a second copy of
 * `datedItems`, `decorateItem`, `duetime` and the rest, in Deno, drifting away
 * from the first the moment either is touched — a class of bug where the
 * calendar quietly disagrees with the app and nobody notices for a month.
 *
 * So the app renders the whole calendar, exactly as it renders the download,
 * and uploads the finished text. The function looks up one row by token and
 * returns it. There is one emitter, and the server holds no opinion about what
 * a deadline is.
 *
 * The cost is stated rather than hidden: **the feed is only as fresh as the
 * last time a signed-in device synced.** A student who stops opening the app
 * has a calendar that stops moving. `freshness` below is what says so on the
 * screen, and the calendar itself carries the same line as its description.
 *
 * ## The link is a password
 *
 * There is no sign-in on a calendar subscription — Apple and Google fetch the
 * URL with no credentials and no way to supply any. So the token in the URL is
 * the whole of the authentication, and anyone holding it can read every
 * deadline in the account. That is the deal every calendar feed makes,
 * including the Brightspace one this app already consumes, and the only honest
 * way to offer it is to say so plainly, keep the token out of anything that
 * gets logged or shared, and make it revocable in one tap.
 */

/** The Edge Function's name, and so the path it is served at. */
export const FEED_PATH = 'calendar';

/**
 * 24 random bytes as hex. Long enough that guessing is not a strategy, short
 * enough to survive being pasted into a calendar app's URL box by hand.
 */
export const TOKEN_BYTES = 24;

export function newToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function looksLikeToken(value: string): boolean {
  return new RegExp(`^[0-9a-f]{${TOKEN_BYTES * 2}}$`).test(value);
}

/**
 * Where the feed lives.
 *
 * The token is a path segment rather than a query parameter, because some
 * calendar clients drop the query string when they store a subscription and
 * the student ends up with a feed that worked exactly once.
 */
export function feedUrl(base: string, token: string): string {
  return `${base.replace(/\/$/, '')}/${FEED_PATH}/${token}`;
}

/**
 * The same URL, as `webcal:`.
 *
 * Not a real scheme — it is `https` wearing a hat that makes iOS and macOS
 * open the subscribe sheet instead of downloading the file. Offering only the
 * `https` link is how somebody ends up with a stale copy while believing they
 * subscribed.
 */
export function webcalUrl(url: string): string {
  return url.replace(/^https?:/, 'webcal:');
}

/** How long before a feed is old enough to be worth explaining. */
export const STALE_HOURS = 24;

/**
 * What the screen says about how current the feed is.
 *
 * Never "up to date" without having checked: this reports the last upload,
 * because that is the only thing the app actually knows.
 */
export function freshness(updatedAt: number | undefined, now: Date): string {
  if (!updatedAt) return 'Nothing published yet. It goes up the next time this device syncs.';
  const hours = Math.floor((now.getTime() - updatedAt) / 3_600_000);
  if (hours < 1) return 'Published in the last hour.';
  if (hours < STALE_HOURS) return `Published ${hours} ${hours === 1 ? 'hour' : 'hours'} ago.`;
  const days = Math.floor(hours / 24);
  return `Published ${days} ${days === 1 ? 'day' : 'days'} ago. It only moves when a signed-in device syncs, so this one has not been opened in a while.`;
}

/** Said next to the link, every time, without a hover or a footnote. */
export const SHARE_WARNING =
  'Treat this link like a password. A calendar subscription cannot sign in, so the link is the only thing standing between your deadlines and whoever has it — anyone you send it to can read all of them, and keep reading them. Replace it if you paste it somewhere you should not have.';

/** Said when the link is replaced, because the old one stops working. */
export const REPLACED_LINE =
  'The old link is dead. Any calendar still subscribed to it will stop updating and eventually say the feed is gone, so re-subscribe on each device with the new one.';

/** Carried inside the calendar, where somebody reading it in Apple Calendar sees it. */
export const FEED_NOTE =
  'Published by Semester. It updates when a signed-in device syncs, not continuously.';

export interface Published {
  token: string;
  /** Milliseconds. When the app last uploaded the rendered calendar. */
  updatedAt?: number;
  /** How many entries went up, so the screen can say what is in it. */
  events?: number;
}

/** Read a published-feed record back off a store that may hold anything. */
export function readPublished(value: unknown): Published | null {
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.token !== 'string' || !looksLikeToken(row.token)) return null;
  return {
    token: row.token,
    updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : undefined,
    events: typeof row.events === 'number' ? row.events : undefined,
  };
}
