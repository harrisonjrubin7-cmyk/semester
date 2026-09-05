/**
 * Which screens actually get opened, counted on the device and nowhere else.
 *
 * The app has forty-odd screens. Some of them are used every day and some have
 * never been opened by anybody, and the second kind is worth finding: a screen
 * nobody uses is not neutral, it is a row in a directory, a line in search, and
 * a thing somebody has to read past to get to what they wanted.
 *
 * ## It does not leave the device, and that is a decision rather than an
 * ## oversight
 *
 * The spec that asked for this described it as analytics — disclosed and
 * opt-out — with the purpose of deleting screens nobody uses, which implies
 * somebody other than the student reading the numbers. That step is not taken
 * here. The privacy page currently says, in as many words, that signed out
 * nothing leaves the device and that there is no third-party analytics, and
 * those sentences are the reason somebody hands this app their coursework.
 * Quietly making them narrower to learn which screens are popular is a bad
 * trade, and it is one that should be made deliberately, in the open, if it is
 * made at all.
 *
 * So the counts stay in `localStorage`, in their own key, outside everything
 * that syncs. What they buy today is for the student: which screens they
 * actually use, which they have never opened, and therefore whether the tab
 * bar and the directory are carrying things they do not want. That is a real
 * answer to the same question, arrived at from their side of it.
 *
 * ## Counts, not a trail
 *
 * A number per screen. Not when, not in what order, not how long — a sequence
 * of screens with times on it is a record of somebody's day, and this is
 * supposed to answer "is anyone using the essay tool", which a total answers
 * perfectly well.
 *
 * Kept separate from `state.visited`, which records the single fact that a
 * screen has been opened at all and exists so progressive disclosure never
 * takes a screen back. That must never read these counts: unlocking on "you
 * have used the app five times" is exactly the thing `lib/reveal.ts` refuses.
 */

export const USAGE_KEY = 'semester.usage';

/** A screen opened this many times more than this is not the question. */
const MAX = 1_000_000;

export type Counts = Record<string, number>;

/** Whatever is in storage, made safe to add to. */
export function read(raw: string | null): Counts {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Counts = {};
    for (const [screen, n] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
        out[screen] = Math.min(MAX, Math.floor(n));
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** One more open of a screen. Pure — the caller stores the result. */
export function note(counts: Counts, screen: string): Counts {
  if (!screen) return counts;
  const now = Math.min(MAX, (counts[screen] ?? 0) + 1);
  return { ...counts, [screen]: now };
}

/** The most-opened screens, most first. Ties by name so the order is stable. */
export function top(counts: Counts, limit = 6): { screen: string; n: number }[] {
  return Object.entries(counts)
    .map(([screen, n]) => ({ screen, n }))
    .sort((a, b) => b.n - a.n || a.screen.localeCompare(b.screen))
    .slice(0, limit);
}

/** Screens that exist and have never been opened on this device. */
export function neverOpened(counts: Counts, screens: string[]): string[] {
  return screens.filter((s) => !counts[s]).sort();
}

/** How many times anything has been opened. */
export function total(counts: Counts): number {
  return Object.values(counts).reduce((n, x) => n + x, 0);
}

/**
 * What the setting says about itself.
 *
 * Names the storage key and says where the numbers go, which is nowhere. A
 * disclosure that says "we collect anonymous usage data" tells somebody
 * nothing they can act on; naming the key means they can go and look.
 */
export function usageLine(on: boolean, counts: Counts): string {
  if (!on) {
    return 'Off. Nothing is being counted. Screens you have already opened stay unlocked either way — that is a separate list.';
  }
  const n = total(counts);
  if (n === 0) {
    return 'A count per screen, kept on this device in “semester.usage” and never uploaded. Nothing counted yet.';
  }
  return `A count per screen, kept on this device in “semester.usage” and never uploaded. ${n} ${n === 1 ? 'screen open' : 'screen opens'} so far, across ${Object.keys(counts).length} of them.`;
}

/** What the list of never-opened screens is for, in the place it is shown. */
export function unusedLine(unopened: number, ofTotal: number): string {
  if (ofTotal === 0) return '';
  if (unopened === 0) return 'You have opened every screen in the app at least once.';
  return `${unopened} of ${ofTotal} screens you have never opened. Turning on “only show what I have earned” hides most of them until there is something in them for you.`;
}
