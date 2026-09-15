import { describe, expect, it } from 'vitest';
import { openEvidence } from './open';

/**
 * Tapping evidence opens the record, not just the screen.
 *
 * `EvidenceRef.id` is documented as *"the record's own id, for a screen that
 * can open one"*, and `InsightCards` dispatched a bare `go` and threw it away.
 * The card's *other* handler, thirty lines up, is careful to send
 * `action.tab` — the same lesson, learned once and not carried across.
 *
 * These are behavioural rather than a source census because the mapping is a
 * pure function with five cases; a census would only tell us the call site
 * exists, which the type checker already does.
 */

describe('opening a piece of evidence', () => {
  it('opens a deadline by id', () => {
    expect(openEvidence({ says: 'Problem Set 3', screen: 'item', id: 'i7' })).toEqual([
      { type: 'openItem', id: 'i7' },
    ]);
  });

  /*
   * A day, not a screen. The attendance card lists dates, so this is the row
   * the whole finding was found on: "ECON 1020 · 2026-09-08 — absent" used to
   * open the calendar wherever it was last left.
   */
  it('opens a day on the calendar, view and all', () => {
    expect(openEvidence({ says: 'ECON 1020 · 2026-09-08 — absent', screen: 'calendar', id: '2026-09-08' })).toEqual([
      { type: 'setCalDay', date: '2026-09-08' },
      { type: 'setCalView', view: 'day' },
      { type: 'go', screen: 'calendar' },
    ]);
  });

  /*
   * The honest half. Three of the five screens evidence points at are given an
   * id by their insight and have no action that opens one — a drill key, a
   * sitting id, a `course:index` pair. Carrying the id no further than the
   * screen is the truthful behaviour until those screens can open a record,
   * and pinning it here is what stops somebody inventing a mapping that
   * silently does nothing.
   */
  it('goes to the screen when the id names nothing openable', () => {
    for (const screen of ['drill', 'exam', 'courses'] as const) {
      expect(openEvidence({ says: 'x', screen, id: 'whatever' })).toEqual([
        { type: 'go', screen },
      ]);
    }
  });

  it('does nothing for a row with no screen', () => {
    expect(openEvidence({ says: 'a record with nowhere to go' })).toEqual([]);
  });

  it('goes to the screen when there is no id', () => {
    expect(openEvidence({ says: 'x', screen: 'item' })).toEqual([{ type: 'go', screen: 'item' }]);
  });
});
