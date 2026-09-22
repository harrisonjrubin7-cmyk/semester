import { describe, expect, it } from 'vitest';
import { FAILURES, say } from './failure';
import { explainSync, explainSyncError } from './cloud';

/**
 * The three lines a failure owes, and the one path that never got them.
 *
 * `lib/failure.ts` exists because `explainSyncError` classifies by matching
 * English prose out of a database, and its own header says why that is
 * fragile. It carries, for each of eight codes, what happened, **what was
 * preserved**, and what to do — the middle one "the part every error message
 * leaves out and the one that decides whether somebody retypes an hour of
 * work", required rather than optional.
 *
 * `say()` renders those three lines and had no caller. `classify()` ran on
 * every sync failure and its answer was dropped one line later. So a failure
 * whose wording matched none of the three regexes reached the student as the
 * server's raw sentence, printed after "Sync failed." by
 * `screens/Account.tsx` — no statement of what survived, no next step.
 */

/** An error carrying the structured fields PostgREST and Supabase send. */
function err(message: string, fields: { code?: string; status?: number } = {}): Error {
  return Object.assign(new Error(message), fields);
}

const REF = () => 'SEM-TEST';

describe('a sync failure no regex recognises', () => {
  it('says what was kept and what to do, instead of only the server sentence', () => {
    const said = explainSync(err('connection reset by peer'), REF()).said;
    expect(said).toContain(FAILURES.INTERNAL_ERROR.kept);
    expect(said).toContain(FAILURES.INTERNAL_ERROR.next);
  });

  /*
   * The guard. Put `explainSync` back to `${explainSyncError(message)}` and
   * this goes red: the raw sentence comes through with neither line.
   */
  it('is not just the raw message with a reference bolted on', () => {
    const message = 'connection reset by peer';
    const said = explainSync(err(message), REF()).said;
    expect(said).not.toBe(`${message}\n\nReference: SEM-TEST`);
  });

  it('carries the reference either way', () => {
    expect(explainSync(err('connection reset by peer'), 'SEM-0001').said).toContain('SEM-0001');
  });

  /*
   * Classified from the structured field, which is the whole reason the
   * module exists: the prose here says nothing, and 409 says conflict.
   */
  it('takes the category from the status rather than the prose', () => {
    const said = explainSync(err('request failed', { status: 409 }), REF()).said;
    expect(said).toContain(FAILURES.CONFLICT.kept);
  });

  /*
   * §337, and the reason `verbatim` is a field. A validation message names a
   * field somebody just typed into; an unrecognised internal error is a stack
   * frame or a table name.
   */
  it('shows the server words where verbatim allows and withholds them where it does not', () => {
    const shown = explainSync(err('column "titel" does not exist in body', { status: 422 }), REF()).said;
    expect(shown).toContain('column "titel" does not exist in body');
    const withheld = explainSync(err('pq: connection string is bad'), REF()).said;
    expect(withheld).not.toContain('pq: connection string is bad');
  });
});

describe('the three sentences that were already right', () => {
  /*
   * The control that matters most. Every assertion above is satisfied by a
   * change that routes *everything* through `say()`, which would throw away
   * the specific deployment advice this repository deliberately kept — the
   * paragraph naming the first migration file, the one about a stale schema
   * cache, the row-level-security one. A category cannot say any of that.
   */
  it.each([
    ['relation "state" does not exist', '20260901000100_schema.sql'],
    ['JWT expired', 'Sign out and back in.'],
    ['new row violates row-level security policy', 'Re-run it.'],
  ])('keeps its own advice for %s', (message, advice) => {
    const said = explainSync(err(message), REF()).said;
    expect(said).toContain(advice);
    // And the server's own words, which each of those branches quotes.
    expect(said).toContain(message);
  });

  /*
   * A second control, on the seam rather than the output. `explainSync` tells
   * a match from a fall-through by comparing the result with its input, so
   * that property has to hold: every recognising branch must lengthen the
   * string, and the last resort must return it unchanged.
   */
  it('is told apart from a fall-through by length, which is how the seam works', () => {
    for (const m of ['relation "state" does not exist', 'JWT expired', 'violates policy']) {
      expect(explainSyncError(m)).not.toBe(m);
    }
    expect(explainSyncError('connection reset by peer')).toBe('connection reset by peer');
  });
});

describe('the table the lines come from', () => {
  /*
   * A control on the data. Every case above still passes if some entry's
   * `kept` is emptied, since an empty string is contained by everything —
   * and `kept` being present is the requirement the module was built around.
   */
  it('has all three lines on every one of the eight codes', () => {
    for (const [code, f] of Object.entries(FAILURES)) {
      expect(f.said.length, `${code}.said`).toBeGreaterThan(0);
      expect(f.kept.length, `${code}.kept`).toBeGreaterThan(0);
      expect(f.next.length, `${code}.next`).toBeGreaterThan(0);
    }
  });

  it('orders them said, kept, next', () => {
    const s = say('CONFLICT');
    expect(s.indexOf(FAILURES.CONFLICT.said)).toBeLessThan(s.indexOf(FAILURES.CONFLICT.kept));
    expect(s.indexOf(FAILURES.CONFLICT.kept)).toBeLessThan(s.indexOf(FAILURES.CONFLICT.next));
  });
});
