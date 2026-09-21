import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The checklist's two bundle figures say the same number.
 *
 * `REGRESSION-CHECKLIST.md` is executed by hand, and CLAUDE.md names it as the
 * file that holds the baseline figures. It held one from 2026-09-10 and went
 * on holding it: by 2026-09-21 the suite had gone 5,212 tests to 11,180 and
 * the entry chunk 562,445 B to 511,045 B, and both gates that read those
 * numbers had quietly stopped being able to fail. A1 would have passed with
 * half the tests in the repository deleted. B1 asked that the entry chunk not
 * grow beyond a ceiling 51,400 B above where the chunk actually was — ten per
 * cent of slack, in the one line that exists to stop the bundle growing.
 *
 * Nothing went wrong for eleven days, which is why nobody looked. That is the
 * failure mode a hand-run gate has and an automated one does not, and it is
 * the reason for this file.
 *
 * ## What is checked, and what deliberately is not
 *
 * Not the test count. Tests churn — this repository adds them by the hundred
 * in a week — and `lib/counts.ts` has already argued this out at length for
 * the destination count: a test that merely *checks* a churning number "turns
 * every one of those into a failure somebody has to hand-fix", and the honest
 * answer there was to generate it or stop stating it. A1 now states a rule
 * relative to the last recorded run rather than a number, so there is no
 * figure left to rot.
 *
 * What is checked is the pair that cannot churn because both halves live in
 * this one file: the figures block's entry-chunk reading, and B1's ceiling.
 * Re-taking one and forgetting the other is exactly what happened — the run
 * logs below restated the entry size eleven times while the ceiling above
 * them never moved. `counts.ts` records the same shape of fault in a
 * different file: "one file said sixty and fifty-eight, and the half that was
 * generated is the half that stayed right".
 *
 * This cannot tell you the figures are *true* — that needs a build, and the
 * build is not a test. It can tell you the file does not contradict itself,
 * which is the half that went wrong.
 */
const CHECKLIST = join(process.cwd(), '..', 'REGRESSION-CHECKLIST.md');
const doc = readFileSync(CHECKLIST, 'utf8');

/** A number written the way this file writes them: 511,045. */
const bytes = (s: string): number => Number(s.replace(/,/g, ''));

describe('the regression checklist', () => {
  it('states a figures block this test can find', () => {
    expect(doc, 'the <!--figures--> block is gone').toContain('<!--figures-->');
    const block = /<!--figures-->([\s\S]*?)<!--\/-->/.exec(doc);
    expect(block, 'the figures block is no longer closed').not.toBeNull();
    expect(block![1], 'the figures block no longer reports the entry chunk').toMatch(
      /entry index-\*\.js = [\d,]+ B/,
    );
  });

  it('gives B1 a ceiling this test can find', () => {
    expect(doc, "B1's ceiling is no longer marked").toMatch(/<!--entry-->[\d,]+<!--\/-->/);
  });

  it('does not let the ceiling sit above the reading', () => {
    const read = bytes(/<!--figures-->[\s\S]*?entry index-\*\.js = ([\d,]+) B/.exec(doc)![1]);
    const ceiling = bytes(/<!--entry-->([\d,]+)<!--\/-->/.exec(doc)![1]);
    expect(read).toBeGreaterThan(0);
    // Equal, not "within a bit". A ceiling above the reading is slack, and
    // slack is the whole of the fault this file records: 51,400 B of it, which
    // read as a passing gate every time somebody ran it.
    expect(
      ceiling,
      `B1 allows ${ceiling} B and the figures block reads ${read} B — ` +
        `${ceiling - read} B of slack. Re-take both, or neither.`,
    ).toBe(read);
  });

  it('no longer asks A1 for a fixed test count', () => {
    const a1 = /\*\*A1\*\* `cd app && npm test`([\s\S]*?)\n\n/.exec(doc)?.[1] ?? '';
    expect(a1, 'A1 is missing from the gates list').not.toBe('');
    // The specific rot: "260 files pass, >= 5,212 tests pass". A floor written
    // once is a floor that fails open, and this one did for eleven days.
    expect(a1, 'A1 has gone back to a fixed floor, which cannot stay true').not.toMatch(
      /≥\s*[\d,]+\s*tests pass/,
    );
    expect(a1, 'A1 no longer says what it is measured against').toMatch(/last run recorded/);
  });
});
