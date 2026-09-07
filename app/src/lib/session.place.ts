/**
 * Where a reading belongs in a guide.
 *
 * A unit added to a course used to go on the end, whatever it was about. The
 * comment that said so — "at the end, where a new reading actually belongs" —
 * is true of a reading with nothing to place it by and false of most of them:
 * a professor posts "Session 7 slides" in week seven, and a guide whose unit 3
 * is Session 3 knows exactly where that goes. Putting it after unit 11 buries
 * it under six weeks of material it comes before.
 *
 * So: read a number out of what the student called it or where it came from,
 * match it against the numbers the guide's own units carry, and slot it in. No
 * number anywhere means the end, which is the old behaviour and the right
 * answer when nothing is known.
 *
 * ## Why the guide's own numbering rather than a counter
 *
 * Units are named `3 · Optimization & Opportunity Cost` and sometimes
 * `3/4 · Market failure` — see `lib/unit.ts`, which strips exactly this. The
 * number is the course's own, not a position: a guide can open at unit 0, skip
 * a number, or cover two sessions in one unit. Counting array positions would
 * put Session 7 after the seventh unit, which is only the same thing when the
 * numbering happens to be dense and start at one.
 */

/** The forms a session number is written in, in a title or a filename. */
const NAMED = /\b(?:session|week|unit|chapter|ch|lecture|lesson|class|module|part|topic)\s*\.?\s*(\d{1,2})\b/i;

/** `7 · Something`, or `07 - Something`, or a bare leading number. */
const LEADING = /^\s*(\d{1,2})\s*(?:[·:.\-–—]|\s)/;

/**
 * The number a piece of material names, or null.
 *
 * Capped at two digits on purpose. A filename is full of numbers that are not
 * session numbers — dates, years, page counts, `v2` — and "Reading 2026" is a
 * year. Two digits covers every week of a semester and excludes most of the
 * noise; the named forms are tried first for the same reason.
 */
export function sessionIn(text: string | undefined): number | null {
  if (!text) return null;
  const named = NAMED.exec(text);
  if (named) return Number(named[1]);
  const leading = LEADING.exec(text);
  if (leading) return Number(leading[1]);
  return null;
}

/**
 * The number a unit carries in its own name, or null.
 *
 * `3/4 · Market failure` counts as 3 — the first session it covers — because
 * that is where it sits in the order. Anything after that unit belongs after
 * both sessions it spans.
 */
export function unitNumber(name: string): number | null {
  const m = /^\s*(\d+)(?:\/\d+)?\s*·/.exec(name);
  return m ? Number(m[1]) : null;
}

/**
 * Where in the unit list an added unit for session `n` goes.
 *
 * After the last unit numbered `n` or lower, so a Session 7 reading lands
 * behind the guide's own Session 7 rather than in front of it — the guide's is
 * the lecture and yours is what you read afterwards. Returns the end when
 * nothing is numbered, or when everything is numbered higher and the reading
 * therefore comes first.
 */
export function slotFor(units: { name: string }[], n: number | null): number {
  if (n === null) return units.length;
  let at: number | null = null;
  for (let i = 0; i < units.length; i += 1) {
    const own = unitNumber(units[i].name);
    if (own !== null && own <= n) at = i;
  }
  // Every numbered unit is above this one: it goes in front of the first of
  // them, not on the end.
  if (at === null) {
    const first = units.findIndex((u) => unitNumber(u.name) !== null);
    return first === -1 ? units.length : first;
  }
  return at + 1;
}

/**
 * A name for an added unit that reads like the guide's own.
 *
 * `Session 7 slides` becomes `7 · Session 7 slides` when the guide numbers its
 * units, so the field guide's contents list does not have one entry with no
 * number in the middle of eleven that have one. Left alone when the guide does
 * not number, and left alone when the title already starts with the number.
 */
export function nameFor(title: string, n: number | null, numbered: boolean): string {
  const clean = title.trim() || 'Added material';
  if (n === null || !numbered) return clean;
  if (/^\s*\d+(\/\d+)?\s*·/.test(clean)) return clean;
  return `${n} · ${clean}`;
}
