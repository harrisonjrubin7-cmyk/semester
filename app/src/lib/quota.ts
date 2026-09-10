/**
 * A warning before the disk fills, instead of a deletion after it did.
 *
 * The old answer to a full device was `lib/keep.ts`: when the write failed,
 * throw away old practice papers and blank the bodies of old notes until it
 * fit, then say so. That was the right thing to do about a 5MB ceiling the app
 * had already passed — but it is the app deleting somebody's work as normal
 * operation, and on IndexedDB there is no such ceiling to hit.
 *
 * So on that path nothing is ever shed, and this replaces it: a line that
 * appears while there is still room to do something about it, saying to take a
 * backup. A warning, not a deletion.
 *
 * The browser's own estimate is what it says it is — an estimate, rounded hard
 * for privacy, and absent entirely in some browsers. Nothing here is presented
 * as more certain than that.
 */

/** How full before it is worth saying anything. */
export const WARN_AT = 0.8;

/** And where it stops being a warning. */
export const URGENT_AT = 0.95;

export interface Room {
  used: number;
  total: number;
  /** 0 to 1, or null when the browser will not say. */
  share: number | null;
}

export async function room(): Promise<Room | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const e = await navigator.storage.estimate();
    const used = e.usage ?? 0;
    const total = e.quota ?? 0;
    return { used, total, share: total > 0 ? used / total : null };
  } catch {
    return null;
  }
}

function mb(n: number): string {
  return n >= 1_000_000_000
    ? `${(n / 1_000_000_000).toFixed(1)} GB`
    : `${Math.round(n / 1_000_000)} MB`;
}

/**
 * What to say about it, or nothing.
 *
 * Nothing is the normal answer, and it stays nothing right up to four fifths
 * full. A storage warning somebody sees every day is one they stop reading
 * before the day it matters.
 */
export function roomLine(r: Room | null): string {
  if (!r || r.share === null || r.share < WARN_AT) return '';
  const where = `${mb(r.used)} of about ${mb(r.total)}`;
  if (r.share >= URGENT_AT) {
    return `This browser is nearly out of room for the app — ${where}. Take a backup under Take it with you now, then remove some attachments: an attachment is usually what fills it.`;
  }
  return `This browser is getting full — ${where}. Nothing is at risk yet and nothing will be deleted, but it is worth taking a backup under Take it with you.`;
}

/** How often it is worth asking. Rarely: the number moves slowly. */
export const CHECK_EVERY_MS = 2 * 60 * 1000;

/**
 * What to say when a write has actually failed.
 *
 * Not a share of a quota — news about a write the database refused. The
 * estimate above is a guess made every couple of minutes, and it is no help
 * at all when the disk is full but the origin's quota is not, or in a browser
 * whose `estimate()` is coarse or absent.
 *
 * It says the two things a person can act on: that what they are doing is not
 * being kept, and where the door out is. `App.tsx` draws it without a timer,
 * for the reason written there — *"a message that fades after four seconds is
 * worse than none because it makes them think they imagined it"*.
 */
export const WRITE_FAILED =
  'Your changes are not being saved \u2014 the browser refused to write to its own database. ' +
  'This is usually a full disk, or a private window. Anything since will be lost on reload: ' +
  'take a backup under Take it with you, and free some room.';
