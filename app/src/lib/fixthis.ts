import type { Kind } from './feedback';
import type { Screen } from './types';

/**
 * "Fix this" — the correction path every factual, sourced or generated thing
 * should offer, in the same seven words everywhere.
 *
 * The app could already take a report: `components/SaySomething.tsx` sends
 * one with a route shape and no personal data, and a source badge with
 * `onReport` opens it on "wrong information". But the badge does that on two
 * screens, and a student who thinks a recommendation is irrelevant, an answer
 * is wrong, or something should be private had to find the general report and
 * work out which of five kinds it was. These are the brief's seven, each
 * mapped to what the app already does: a report that opens on the right kind
 * with the right first words, or the screen where the thing is fixed.
 *
 * `components/FixThis.tsx` draws them inside "About this screen", which is on
 * every screen, so the path is everywhere without every screen adding it.
 */
export interface Fix {
  id: string;
  label: string;
  /** A report of this kind, opened with these first words. */
  report?: { kind: Kind; note: string };
  /** Or the screen where it is fixed. */
  screen?: Screen;
}

export const FIXES: readonly Fix[] = [
  { id: 'deadline', label: 'This deadline looks wrong', report: { kind: 'wrong', note: 'A deadline looks wrong: ' } },
  { id: 'stale', label: 'This source is out of date', report: { kind: 'wrong', note: 'A source is out of date: ' } },
  { id: 'irrelevant', label: 'This recommendation is not relevant', report: { kind: 'confusing', note: 'This recommendation does not fit me: ' } },
  { id: 'answer', label: 'This answer is incorrect', report: { kind: 'wrong', note: 'An answer from Ask Semester is incorrect: ' } },
  { id: 'private', label: 'This information should be private', screen: 'privacy' },
  { id: 'barrier', label: 'Report an accessibility barrier', report: { kind: 'bug', note: 'Accessibility barrier: ' } },
  { id: 'help', label: 'Get help', screen: 'help' },
];
