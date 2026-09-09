import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * The month's day panel says what is on that day, and it has to say all of it.
 *
 * The panel is a run of sections — deadlines, your tasks, your appointments,
 * campus, a connected calendar — and then one condition that decides whether
 * to draw "Nothing due this day" instead. Every section added since has had
 * to remember to join that condition, and twice one did not: the campus
 * calendar first (see the note beside the marks in `Calendar.tsx`), and then
 * appointments, where a cell reading "Wednesday 16 September. 1 appointment."
 * said "Nothing due this day" the moment you tapped it. The grid had counted
 * the thing the panel then denied.
 *
 * It is the same mistake both times because nothing connects the two halves:
 * a section is JSX in one place and a name in a boolean two hundred lines
 * down, and the compiler is happy either way.
 *
 * ## What this test can and cannot do
 *
 * It cannot open the panel — that needs a browser, and the day holding one
 * appointment, the day holding two, every chip and a day with nothing on it
 * were all checked in one. What it can do is hold the join: a list drawn as
 * rows is a list the empty state must know about, so the next section added
 * cannot repeat this by omission.
 */

const SRC = readFileSync(new URL('./Calendar.tsx', import.meta.url), 'utf8');
const MONTH = SRC.slice(SRC.indexOf('function MonthView()'));

describe("the month day panel's empty state", () => {
  it('names every list the panel draws rows from', () => {
    const drawn = [...MONTH.matchAll(/\b(sel[A-Z]\w*)\.map\(/g)].map((m) => m[1]);
    expect(new Set(drawn).size).toBeGreaterThan(3); // the slice found the panel

    const at = MONTH.indexOf('title="Nothing due this day"');
    expect(at).toBeGreaterThan(0);
    const condition = MONTH.slice(Math.max(0, at - 400), at);

    for (const list of new Set(drawn)) {
      expect(condition, `${list} is drawn as rows but the empty state ignores it`).toContain(
        `${list}.length === 0`,
      );
    }
  });

  it('gates appointments in the panel on the chip that marks them on the grid', () => {
    // The marks and the panel read the same flag, so a chip cannot take
    // appointments off the grid and leave them listed underneath it — or, as
    // it was, mark them on the grid and leave them out from underneath.
    expect(MONTH).toMatch(/if \(on\.classes\) \{\s*state\.appointments\.forEach\(/);
    expect(MONTH).toMatch(/const selAppts = on\.classes \?/);
  });
});
