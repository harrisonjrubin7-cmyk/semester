import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What comes off the screen and onto the page.
 *
 * Thirteen screens carry a Print button, and printing is not nostalgia in a
 * university — a cram sheet goes on a wall and an exam hall does not allow a
 * phone. The print rule dropped every `<button>`, on the reasonable ground
 * that anything you press is noise on paper.
 *
 * It is not reasonable in this app. A deadline, a task and a campus listing
 * are each drawn as a row you press, so the row is a `<button>`, so the row
 * was not on the paper. Measured on The week ahead, whose own button says
 * "Print the week": "Reflection #2", "Quiz #2", "Midterm" and "CORE 2500"
 * were all on screen and none of them on the page — the printed week had its
 * headings, its empty days, and not one deadline.
 *
 * ## Why an allowlist, which is the part worth keeping
 *
 * The first attempt at this inverted the rule — `button:not(.tappable)`, on
 * the strength of `.tappable` being documented as "rows and cards the
 * prototype made clickable". It is not: 123 buttons wear it and a good third
 * are controls. A review bot found the drill's own "✗ Guessed" and "✓ Sure"
 * printing under the answer; scanning the source for the rest turned up "Set
 * no school", "Just start", "Forget the counts", "Delete" and thirty more.
 *
 * So the default is the safe one — a button does not print — and a row that
 * is content says so. Seven of them, and the number is the point: a rule with
 * thirty exceptions is a rule that will be wrong again.
 */

const CSS = readFileSync(new URL('./app.css', import.meta.url), 'utf8');
/*
 * Comments stripped, because the rule is what is asserted about.
 *
 * The block explains the approach it replaced, so a check for the old
 * selector found it in the prose describing it and failed against a
 * stylesheet that was correct. That is the second time in this change a test
 * matched a comment for the thing it documents.
 */
const PRINT = CSS.slice(CSS.indexOf('@media print')).replace(/\/\*[\s\S]*?\*\//g, '');

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : e.name.endsWith('.tsx') && !e.name.includes('.test.')
        ? [join(dir, e.name)]
        : [],
  );

/** Every button that prints, by the class that says so. */
const printing = (): string[] => {
  const root = new URL('..', import.meta.url).pathname;
  return sources(root).flatMap((f) => {
    const src = readFileSync(f, 'utf8');
    return [...src.matchAll(/className="([^"]*)"/g)]
      .filter((m) => m[1].split(/\s+/).includes('on-paper'))
      .map(() => (f.split('/src/')[1] ?? f));
  });
};

describe('the print rule', () => {
  it('hides a button unless it says it is content', () => {
    expect(PRINT).toContain('button:not(.on-paper)');
    // Not `button` alone: that took 172 rows off the paper. Not
    // `button:not(.tappable)` either: that put forty controls back on it.
    expect(PRINT).not.toMatch(/^\s*button,\s*$/m);
    expect(PRINT).not.toContain('button:not(.tappable)');
  });
});

describe('the rows that print', () => {
  /*
   * Named, and few.
   *
   * This list is the whole safety argument: everything else in the app stays
   * off the paper by default, so a control added next year cannot arrive on
   * it by accident. A row added to this list is somebody deciding, once, that
   * it is content — which is a line to add here, after looking at the page.
   */
  const NAMED = [
    'components/DeadlineRow.tsx',
    /*
     * The work filed against a deadline, on the printed deadline.
     *
     * Added deliberately, after the same argument the deadline row itself
     * won: these rows are the only record on the page of what the draft, the
     * sheet and the two readings for this piece of work are called. A printed
     * deadline that named its weight and its quote and none of the work being
     * done for it would be the same hole this list was made to close.
     */
    'components/ForThis.tsx',
    'components/StartToday.tsx',
    'screens/Ahead.tsx',
    'screens/Calendar.tsx',
    'screens/Runway.tsx',
  ];

  it('are the ones that were measured losing content', () => {
    expect([...new Set(printing())].sort()).toEqual([...NAMED].sort());
  });

  it('stay countable', () => {
    // Nine rows across five files. If this climbs, the allowlist is turning
    // back into the rule it replaced and the page is worth looking at again.
    expect(printing().length).toBeLessThanOrEqual(12);
  });
});
