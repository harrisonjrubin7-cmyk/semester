/**
 * The decision assistant's comparison: options side by side, facts only.
 *
 * A student choosing between two courses, deciding whether to drop one, adding
 * a minor, going abroad, getting a tutor, taking an opportunity or preparing
 * for a meeting needs the same nine questions answered about each option.
 * This puts those nine in a table and stops there.
 *
 * ## It takes facts, it does not make them
 *
 * Every input is something another module already worked out — requirement fit,
 * clashes and credit impact from `course-detail.ts`, the requisite reading, a
 * source label and its date. This file only lays them out. Nothing is fetched,
 * nothing is estimated here, so the table can never say more than the pieces
 * it was handed, and it is a pure function of them.
 *
 * ## There is no winner, and the type has nowhere to put one
 *
 * The result has no `winner`, `score`, `rank` or `verdict` field, and the
 * options come back in the order the student listed them, not sorted by
 * anything. That is deliberate and it is the whole design: a comparison that
 * ends in a number or a highlighted column becomes the decision, and it would
 * be built from a handful of facts that leave out most of what the student
 * knows about their own life. The test walks the result for such keys, so
 * adding one is a visible change and not a drift. (The equity gate has the
 * same line for function names: nothing here is called rank or recommend.)
 *
 * ## Unknown is said out loud
 *
 * A fact nobody supplied is `Not known`, never a blank and never a guess. A
 * blank cell reads as "nothing to worry about", and an option with fewer facts
 * recorded would then look cleaner than one the student researched. `Not known`
 * is the same width as a fact and as visible.
 *
 * ## The official step is always there
 *
 * The last row is who actually decides. If the caller knows the office, it is
 * named; if not, the row says whom to ask for this kind of decision and says
 * that Semester has no contact recorded, rather than leaving it empty. A
 * comparison that ends without a person to confirm it has taken the
 * decision's place.
 */

import { catalogAge, clashLine, type Clash, type Fit, type Impact, type Requisites } from './course-detail';
import { formatDate } from './locale';
import { SOURCE_TEXT, type SourceLabel } from './source';

export const NOT_KNOWN = 'Not known';

export const DECISION_KINDS = ['course', 'drop', 'minor', 'study_abroad', 'tutoring', 'opportunity', 'meeting_prep'] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

export const KIND_LABEL: Record<DecisionKind, string> = {
  course: 'Choosing a course',
  drop: 'Dropping a course',
  minor: 'Adding a minor',
  study_abroad: 'Studying abroad',
  tutoring: 'Getting tutoring',
  opportunity: 'An opportunity',
  meeting_prep: 'Preparing for a meeting',
};

/** The rows, in the order they are read. Fixed: the order is not a ranking of importance either. */
export const ROWS = [
  { id: 'requirementFit', label: 'Requirement fit' },
  { id: 'scheduleImpact', label: 'Schedule impact' },
  { id: 'creditLoadImpact', label: 'Credit-load impact' },
  { id: 'prerequisiteState', label: 'Prerequisite state' },
  { id: 'costTime', label: 'Cost and time' },
  { id: 'sourceAndFreshness', label: 'Source and freshness' },
  { id: 'knownUncertainty', label: 'What is not certain' },
  { id: 'questionsToAsk', label: 'Questions to ask' },
  { id: 'officialNextStep', label: 'Official next step' },
] as const;
export type RowId = (typeof ROWS)[number]['id'];

/** Who confirms a decision of each kind, when the caller has no named office. */
export const DEFAULT_OFFICIAL: Record<DecisionKind, string> = {
  course: 'Ask your academic advisor, and check the registrar’s dates before you register.',
  drop: 'Ask the registrar about the drop deadline and your advisor about what it does to your plan.',
  minor: 'Ask the department that owns the minor, and your advisor, to confirm the requirements.',
  study_abroad: 'Ask the study-abroad office, and your advisor about credit transfer.',
  tutoring: 'Ask the tutoring center what it offers and when.',
  opportunity: 'Ask the office or organisation that runs it, and your advisor if it touches your plan.',
  meeting_prep: 'Ask the person you are meeting what they would like to see beforehand.',
};

/** Questions worth asking for each kind, used only when the caller supplies none for an option. */
export const DEFAULT_QUESTIONS: Record<DecisionKind, readonly string[]> = {
  course: ['Does this count toward a requirement I still need?', 'Is there a section that fits my week?'],
  drop: ['What is the deadline, and what appears on my record?', 'What does dropping change about my plan and credits?'],
  minor: ['Which courses count, and which can double-count?', 'What is the declaration process and deadline?'],
  study_abroad: ['Which courses will transfer, and who approves it in writing?', 'What are the application dates?'],
  tutoring: ['Is there a cost, and how do I book?', 'What should I bring to the first session?'],
  opportunity: ['What is the deadline and the time commitment?', 'Does it affect my course load?'],
  meeting_prep: ['What would be most useful to bring?', 'How long will we have?'],
};

/** What is known about one option. Every field is optional because most options start with little. */
export interface OptionFacts {
  id: string;
  label: string;
  /** From `requirementFit`. An empty list is a fact: it fills none of the recorded requirements. */
  requirementFit?: readonly Fit[] | null;
  /** From `scheduleFit`. An empty list is a fact: no clash with what is recorded. */
  clashes?: readonly Clash[] | null;
  /** From `planImpact`. */
  creditLoad?: Impact | null;
  /** From `requisites`. */
  prerequisites?: Requisites | null;
  /** What it costs. Either part may be absent, and absent is said. */
  cost?: { money?: string | null; hoursPerWeek?: number | null } | null;
  source?: { label: SourceLabel; /** ISO timestamp of the source, when known. */ asOf: string | null } | null;
  /** Things the student or the source flagged as unsettled. */
  uncertainty?: readonly string[];
  questions?: readonly string[];
  official?: { who: string; action: string } | null;
}

export interface Cell {
  /** False when the cell is the placeholder rather than something supplied. */
  known: boolean;
  lines: string[];
}

export interface Row {
  id: RowId;
  label: string;
  /** One cell per option, in the same order as `options`. */
  cells: Cell[];
}

export interface Comparison {
  kind: DecisionKind;
  title: string;
  /** The options in the order the student gave them. Never sorted. */
  options: { id: string; label: string }[];
  rows: Row[];
  /** Shown with the table. */
  note: string;
}

export const NOTE =
  'This puts the facts side by side. It does not say which option is better; that depends on things only you know. The last row says who can confirm.';

const known = (...lines: string[]): Cell => ({ known: true, lines });
const unknown = (): Cell => ({ known: false, lines: [NOT_KNOWN] });
const clean = (items: readonly string[] | undefined): string[] => (items ?? []).map((s) => s.trim()).filter(Boolean);

function requirementCell(f: OptionFacts): Cell {
  if (!f.requirementFit) return unknown();
  if (f.requirementFit.length === 0) return known('Fills none of the requirements you recorded as still needed.');
  return known(
    ...f.requirementFit.map((x) => `${x.requirement.programme}: ${x.requirement.name}${x.elective ? ' (any course counts)' : ''}, ${x.left} ${x.unit} still needed.`),
  );
}

function scheduleCell(f: OptionFacts): Cell {
  if (!f.clashes) return unknown();
  if (f.clashes.length === 0) return known('No clash with your cart or the commitments you recorded.');
  return known(...f.clashes.map(clashLine));
}

function prerequisiteCell(f: OptionFacts): Cell {
  const r = f.prerequisites;
  if (!r) return unknown();
  if (r.items.length === 0 && !r.text && !r.unread) return known('The catalog lists no prerequisites.');
  const lines = r.items.map((i) => i.says);
  if (r.text) lines.push(`The catalog says: “${r.text}”`);
  if (r.unread) lines.push('The catalog line has conditions Semester cannot read. Check with the department.');
  return known(...lines);
}

function costCell(f: OptionFacts): Cell {
  const c = f.cost;
  const money = c?.money?.trim();
  const hours = typeof c?.hoursPerWeek === 'number' && Number.isFinite(c.hoursPerWeek) && c.hoursPerWeek >= 0 ? c.hoursPerWeek : null;
  if (!money && hours === null) return unknown();
  return known(`Money: ${money || NOT_KNOWN}`, `Time: ${hours === null ? NOT_KNOWN : `about ${hours} hour${hours === 1 ? '' : 's'} a week`}`);
}

function sourceCell(f: OptionFacts, now: Date): Cell {
  const s = f.source;
  if (!s) return unknown();
  const age = catalogAge(s.asOf, now);
  const when = age.at === null ? 'date not known' : `as of ${formatDate(age.at, { year: 'numeric', month: 'short', day: 'numeric' })}`;
  return known(`${SOURCE_TEXT[s.label]}, ${when}.`, ...(age.stale ? ['This is more than 60 days old and may have changed.'] : []));
}

function officialCell(kind: DecisionKind, f: OptionFacts): Cell {
  const who = f.official?.who.trim();
  const action = f.official?.action.trim();
  if (who && action) return known(`${who}: ${action}`);
  return { known: false, lines: [DEFAULT_OFFICIAL[kind], 'Semester has no contact recorded for this option.'] };
}

/**
 * The comparison of the options given, in the order given. Pure: the same
 * facts and date always give the same table, with a cell for every option in
 * every row.
 */
export function compareOptions(kind: DecisionKind, options: readonly OptionFacts[], now: Date): Comparison {
  const cells: Record<RowId, (f: OptionFacts) => Cell> = {
    requirementFit: requirementCell,
    scheduleImpact: scheduleCell,
    creditLoadImpact: (f) => (f.creditLoad ? known(f.creditLoad.says) : unknown()),
    prerequisiteState: prerequisiteCell,
    costTime: costCell,
    sourceAndFreshness: (f) => sourceCell(f, now),
    knownUncertainty: (f) => {
      const items = clean(f.uncertainty);
      return items.length ? known(...items) : unknown();
    },
    questionsToAsk: (f) => {
      const own = clean(f.questions);
      return own.length ? known(...own) : { known: false, lines: [...DEFAULT_QUESTIONS[kind]] };
    },
    officialNextStep: (f) => officialCell(kind, f),
  };
  return {
    kind,
    title: KIND_LABEL[kind],
    options: options.map((o) => ({ id: o.id, label: o.label })),
    rows: ROWS.map((r) => ({ id: r.id, label: r.label, cells: options.map((o) => cells[r.id](o)) })),
    note: NOTE,
  };
}

/** A cell as one string, for a plain-text export. */
export const cellText = (cell: Cell): string => cell.lines.join(' ');
