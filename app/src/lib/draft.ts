/**
 * Long text that survives leaving the screen.
 *
 * Notes are safe: the editor dispatches on every keystroke, so a note is in
 * the store and on disk before the next character. Everything else long is
 * not. The essay drafter, the work-through, the email drafter, the reading
 * analyser and the problem solver each hold hundreds or thousands of words in
 * `useState` — which means a tapped Back, a switched tab that the browser
 * later discards, a phone that swaps the page out, or a reload takes the lot
 * with nothing having warned anyone. `beforeunload` appears nowhere in this
 * app, and until this file neither did any other guard.
 *
 * ## Why autosave rather than a confirm dialog
 *
 * The obvious fix is to catch the person leaving and ask. It is the wrong one.
 * A dialog on the way out interrupts every deliberate exit to protect the rare
 * accidental one, cannot be shown at all when the browser discards a
 * background tab, and says nothing about the case people actually hit — coming
 * back later expecting their work to be there.
 *
 * So the draft is written to disk as it is typed, on a debounce, and put back
 * when the screen opens again. Leaving is then not a decision anybody has to
 * make: nothing is at risk, so nothing needs guarding. `beforeunload` is left
 * for the one gap autosave cannot close — the few hundred milliseconds between
 * the last keystroke and the next write — and even then only when there is
 * genuinely something unwritten, because a reload prompt that fires when there
 * is nothing to lose is how people learn to click through them.
 *
 * ## Where they live
 *
 * A key of their own, `semester.drafts`, beside the store rather than inside
 * it. Three reasons, and they all matter:
 *
 *   * A draft is not part of the account. It is not synced, not exported, and
 *     not in a backup — half an unsent email on the laptop should not appear
 *     on the phone.
 *   * `lib/keep.ts` sheds note bodies to make room when the store will not
 *     fit. A draft inside the store would be competing for exactly that
 *     budget, and losing.
 *   * The store is written on every dispatch. A draft written on every
 *     keystroke through the same path would re-serialise the whole account
 *     several times a second.
 *
 * They expire, they are capped, and a failed write is silent — a draft that
 * cannot be saved must not be able to break the screen it was protecting.
 */

export const DRAFTS_KEY = 'semester.drafts';

/** How long after the last keystroke the draft is written. */
export const SETTLE_MS = 700;

/** Dropped after this long. A draft nobody came back to in a fortnight is litter. */
export const KEEP_DAYS = 14;

/** A ceiling on the whole store, so drafts can never crowd out the account. */
export const MOST_BYTES = 400_000;

/** And on any single one, so one pasted book cannot take the budget. */
export const MOST_ONE = 100_000;

export interface Draft {
  text: string;
  /** Milliseconds, last written. */
  at: number;
}

export type Drafts = Record<string, Draft>;

/**
 * The key one field's draft is filed under.
 *
 * Screen and field, so two screens with a `body` do not overwrite each other,
 * and an optional third part for a draft that belongs to one course or one
 * deadline rather than to the screen as a whole.
 */
export function draftKey(screen: string, field: string, about = ''): string {
  return [screen, field, about].filter(Boolean).join(':');
}

export function readDrafts(raw: string | null): Drafts {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Drafts = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const row = value as Record<string, unknown>;
      if (typeof row.text !== 'string' || typeof row.at !== 'number') continue;
      out[key] = { text: row.text, at: row.at };
    }
    return out;
  } catch {
    return {};
  }
}

function weigh(drafts: Drafts): number {
  // Browsers count UTF-16 code units, the same measure `lib/keep.ts` uses.
  return Object.entries(drafts).reduce((n, [k, d]) => n + (k.length + d.text.length) * 2, 0);
}

/**
 * One draft written into the set, with the set kept inside its budget.
 *
 * Expired ones go first, then the oldest, until it fits. The draft being
 * written is never the one thrown away — somebody typing right now is the
 * person least willing to lose anything.
 */
export function withDraft(drafts: Drafts, key: string, text: string, now: number): Drafts {
  const fresh: Drafts = {};
  for (const [k, d] of Object.entries(drafts)) {
    if (k === key) continue;
    if (now - d.at > KEEP_DAYS * 86_400_000) continue;
    fresh[k] = d;
  }

  // An empty field means the draft is finished with, not that it is empty.
  if (text.trim() === '') return fresh;

  const kept = text.length > MOST_ONE ? text.slice(0, MOST_ONE) : text;
  let out: Drafts = { ...fresh, [key]: { text: kept, at: now } };

  while (weigh(out) > MOST_BYTES) {
    const oldest = Object.entries(out)
      .filter(([k]) => k !== key)
      .sort((a, b) => a[1].at - b[1].at)[0];
    if (!oldest) break;
    const { [oldest[0]]: _gone, ...rest } = out;
    out = rest;
  }
  return out;
}

/** Drop one, for when the work it belonged to has been filed. */
export function withoutDraft(drafts: Drafts, key: string): Drafts {
  const { [key]: _gone, ...rest } = drafts;
  return rest;
}

/**
 * What the screen says when it puts a draft back.
 *
 * Said rather than done silently: text appearing in a field nobody typed it
 * into, on a screen they thought was blank, is unsettling in a way that is
 * worth one line to avoid.
 */
export function restoredLine(at: number, now: Date): string {
  const mins = Math.floor((now.getTime() - at) / 60_000);
  if (mins < 2) return 'Picked up where you left off.';
  if (mins < 60) return `Picked up where you left off, ${mins} minutes ago.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Picked up where you left off, ${hours} ${hours === 1 ? 'hour' : 'hours'} ago.`;
  const days = Math.round(hours / 24);
  return `Picked up where you left off, ${days} ${days === 1 ? 'day' : 'days'} ago.`;
}

/**
 * The one thing said on the way out of the tab.
 *
 * Browsers ignore this text and show their own wording, which is why the guard
 * is set at all rather than being relied on to explain anything. It exists
 * here so there is one place saying what the guard is for.
 */
export const LEAVING = 'You have typed something that has not been saved yet.';

/** Said under a long field, so the autosave is visible rather than assumed. */
export const KEPT_LINE = 'Kept on this device as you type. It is not synced and not in your export.';
