import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Every view asks `lib/calsource.ts` which bucket a thing is in.
 *
 * That file states the rule and says why it is a file rather than a condition
 * written out per view: "Two views agreeing by having each written the
 * conditions out is how the third and fourth came to disagree. So the rule is
 * one thing, here, and each view asks it."
 *
 * One copy outlived that. The month's teaching-day marks tested
 * `calSource === 'classes'` instead of the bucket, which made All the single
 * chip that hid your classes — a Monday with a nine o'clock lecture was a
 * blank cell under Everything and a marked one under Classes. A chip called
 * All showing less than a subset of itself is not a thing anybody reads as a
 * filter; it reads as the calendar being wrong.
 *
 * Checked by reading the file, because the failure is invisible in review: the
 * comparison is correct-looking, correct for the chip it names, and wrong only
 * from the one chip nobody re-tests.
 */
const SOURCE = readFileSync(new URL('./Calendar.tsx', import.meta.url), 'utf8');
const lines = SOURCE.split('\n');

/** The nearest `if` above a line, which is what gates it. */
function gateAbove(index: number): string {
  for (let i = index; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('if (')) return line;
  }
  return '';
}

describe('the month grid', () => {
  it('marks its teaching days on the bucket, not on the name of a chip', () => {
    const at = lines.findIndex((l) => l.includes('railFor(catalog, date, []).forEach'));
    expect(at, 'the teaching-day loop moved; point this test at it again').toBeGreaterThan(0);
    expect(gateAbove(at)).toBe('if (on.classes) {');
  });

  it('reads the same bucket into the panel under the grid', () => {
    // A marked cell that answers "Nothing due this day" when you tap it is the
    // disagreement this screen has now fixed three times — for campus events,
    // for your own appointments, and here. The gate has to be the same one.
    const at = lines.findIndex((l) => l.includes('const selClasses ='));
    expect(at, 'the panel no longer reads the day’s classes').toBeGreaterThan(0);
    expect(lines[at]).toContain('on.classes ?');
  });

  it('counts the classes when it decides the day is empty', () => {
    // The last one: the phrase appears twice above in comments recording the
    // two earlier times the panel and the grid disagreed.
    const at = lines.findLastIndex((l) => l.includes('<EmptyState inline title="Nothing due this day"'));
    const near = lines.slice(Math.max(0, at - 8), at).join('\n');
    expect(near).toContain('selClasses.length === 0');
  });
});

describe('what may still name a chip', () => {
  /*
   * Not a blanket ban. `calSource === 'campus'` is a real question about the
   * campus source rather than about a bucket: it is the only source with the
   * third axis — the kind chips — and the only one whose month is a list
   * instead of a grid. Both are documented at the foot of `lib/calsource.ts`.
   * What must not come back is a bucket decision written out per view.
   */
  it('names a source only where the source itself is the question', () => {
    const named = lines
      .map((l, i) => ({ l: l.trim(), i }))
      .filter(({ l }) => /calSource === '/.test(l) && !l.startsWith('*') && !l.startsWith('//'));
    for (const { l } of named) {
      expect(l, `a bucket decision written out again: ${l}`).toContain("'campus'");
    }
  });
});
