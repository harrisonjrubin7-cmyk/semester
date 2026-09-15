/**
 * What tapping a piece of evidence does.
 *
 * `EvidenceRef` has carried an `id` since it was written — *"the record's own
 * id, for a screen that can open one"* — and the card that draws the rows
 * dispatched `go` and dropped it. So an attendance card listing
 * "ECON 1020 · 2026-09-08 — absent" opened the calendar on whichever day the
 * session was last showing, and a pressure card listing four late deadlines
 * opened the deadline screen on whichever deadline was last opened.
 *
 * ## The fix was already in the same interface
 *
 * `Insight.action` carries a `tab` for exactly this reason, and says so:
 *
 * > The grain exists because the grade table stopped being a screen and became
 * > the third tab of Courses: an action that named `courses` alone would land
 * > a projection about a grade on whichever tab was last open.
 *
 * That is this bug, found and fixed once, three fields above the one that
 * still had it. The card honours `action.tab` — *"the grain first, so the
 * screen paints on the part the finding is about rather than switching under
 * somebody"* — thirty lines from the handler that threw `evidence.id` away.
 *
 * Which is the thirteenth pass's whole theme: the lesson had been learned and
 * written down, and had not travelled as far as the next field.
 *
 * ## Why the mapping is short, and honest about it
 *
 * Only two of the five screens evidence points at can open one record:
 * `item` has `openItem`, and the calendar takes a date. `drill`, `exam` and
 * `courses` are given ids by their insights — a drill key, a sitting id, a
 * `course:index` pair — and the app has no action that opens any of them. They
 * go to the screen, as before.
 *
 * That gap is worth stating rather than papering over: the interface promises
 * the record is one tap away, and for three of five screens it is not. Closing
 * it means giving those screens a way to open a record, which is a feature and
 * not this pass's business.
 */

import type { Action } from '../state/shape';
import { openCal } from '../lib/opencal';
import type { EvidenceRef } from './types';

export function openEvidence(e: EvidenceRef): Action[] {
  if (!e.screen) return [];
  if (e.id) {
    // A deadline has a screen of its own, so the row opens the record.
    if (e.screen === 'item') return [{ type: 'openItem', id: e.id }];
    // The calendar's record *is* a day, and reaching one takes three
    // dispatches rather than a `go`. See `lib/opencal.ts`.
    if (e.screen === 'calendar') return openCal(e.id);
  }
  return [{ type: 'go', screen: e.screen }];
}
