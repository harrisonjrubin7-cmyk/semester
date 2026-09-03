/**
 * Writing the store to disk, and knowing when it did not.
 *
 * The write used to be one `try` with a comment reading "storage unavailable"
 * — and that catch swallowed a `QuotaExceededError` exactly as readily as a
 * private window with storage switched off. Past the point where the budget
 * ran out, the app went on working perfectly: notes appeared, ticks stuck,
 * sources saved. Then a reload took the lot, with nothing on any screen having
 * suggested there was a problem.
 *
 * That is the worst shape a failure can have. The two cases are told apart
 * here, the app is told which happened, and a full store is made smaller
 * before the write fails rather than after.
 *
 * ## What gets shed, and in what order
 *
 * Only things the app can rebuild or that have already served their purpose,
 * oldest first: practice papers you have sat, then the bodies of the oldest
 * notes. Never a deadline, a tick, a card review or a source — those are
 * either irreplaceable or the whole point.
 *
 * Shedding is reported, never silent. A save that quietly threw away last
 * month's papers to make room is the same betrayal in a smaller coat.
 */

/** Roughly what a string costs in a browser's storage budget. */
export function weigh(text: string): number {
  // Browsers count UTF-16 code units, so a two-byte character costs two.
  return text.length * 2;
}

export type SaveResult =
  | { ok: true; shed: string[] }
  | { ok: false; reason: 'full'; shed: string[] }
  | { ok: false; reason: 'unavailable'; shed: [] };

/**
 * Is this the error a browser throws when the budget is gone?
 *
 * Every engine spells it differently and two of them use a numeric code that
 * predates the name, which is why this is a list rather than one comparison.
 */
export function isQuotaError(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  const name = e.name;
  const code = (e as DOMException).code;
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    name === 'QUOTA_EXCEEDED_ERR' ||
    code === 22 ||
    code === 1014
  );
}

/**
 * One round of ballast, thrown overboard.
 *
 * Takes the parsed store and returns it lighter, plus a line saying what went.
 * Returns null when there is nothing left it is willing to drop — at which
 * point the honest thing is to fail loudly rather than start on the data
 * somebody would miss.
 */
export function shed(store: Record<string, unknown>): { next: Record<string, unknown>; said: string } | null {
  const sittings = store.sittings;
  if (Array.isArray(sittings) && sittings.length > 5) {
    // Half the papers, oldest first. Halving rather than dropping one keeps
    // this from needing a dozen rounds on a store that is badly over.
    const keep = Math.max(5, Math.floor(sittings.length / 2));
    return {
      next: { ...store, sittings: sittings.slice(0, keep) },
      said: `${sittings.length - keep} old practice papers`,
    };
  }

  const notes = store.notes;
  if (Array.isArray(notes)) {
    // The oldest note with a body long enough to be worth clearing. Its title
    // and its files stay, so the note is still there and still findable —
    // what goes is text the person can see is gone.
    const byAge = [...notes].sort(
      (a, b) => Number((a as { updated?: number }).updated ?? 0) - Number((b as { updated?: number }).updated ?? 0),
    );
    const fat = byAge.find((n) => String((n as { body?: string }).body ?? '').length > 500);
    if (fat) {
      const id = (fat as { id?: string }).id;
      return {
        next: {
          ...store,
          notes: notes.map((n) =>
            (n as { id?: string }).id === id
              ? { ...(n as object), body: '(This note’s text was cleared to make room. Its title and files are intact.)' }
              : n,
          ),
        },
        said: `the text of one old note`,
      };
    }
  }

  return null;
}

/**
 * Save, shedding ballast if the browser says there is no room.
 *
 * Bounded: five rounds, because an unbounded loop against a quota error is a
 * frozen tab. If it still will not fit, that is reported as a failure with
 * whatever was shed on the way, and the caller says so on screen.
 */
export function save(
  text: string,
  put: (value: string) => void = (value) => localStorage.setItem('semester.v1', value),
): SaveResult {
  const shedding: string[] = [];
  let payload = text;

  for (let round = 0; round <= 5; round++) {
    try {
      put(payload);
      return { ok: true, shed: shedding };
    } catch (e) {
      if (!isQuotaError(e)) return { ok: false, reason: 'unavailable', shed: [] };

      let store: Record<string, unknown>;
      try {
        store = JSON.parse(payload) as Record<string, unknown>;
      } catch {
        return { ok: false, reason: 'full', shed: shedding };
      }

      const lighter = shed(store);
      if (!lighter) return { ok: false, reason: 'full', shed: shedding };
      shedding.push(lighter.said);
      payload = JSON.stringify(lighter.next);
    }
  }
  return { ok: false, reason: 'full', shed: shedding };
}

/** What to put on screen. Empty when there is nothing to say. */
export function trouble(result: SaveResult): string {
  if (result.ok) {
    return result.shed.length === 0
      ? ''
      : `Your device's storage was full, so ${result.shed.join(' and ')} had to go. Everything else is saved. Take a backup under Take it with you.`;
  }
  if (result.reason === 'unavailable') {
    return 'This browser will not let the app store anything, so nothing you do here will survive a reload. A private window does this; so does blocking site data.';
  }
  return "Your device's storage is full and the app can no longer save. Nothing new will survive a reload until you free some space — export a backup under Take it with you first, then remove a course or some notes.";
}
