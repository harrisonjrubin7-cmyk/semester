/**
 * The degree audit's arithmetic, in TypeScript: the twin of
 * `private.degree_audit_compute` and `private.degree_audit_inputs_text` in
 * `supabase/migrations/20260930250000_degree_audit.sql`.
 *
 * ## Why there are two
 *
 * The audit that counts is the database's: it runs on the school's published
 * program and the school's ledger and keeps its answer (`degree_audits`).
 * This file is the same computation over plain data, so a screen can say what
 * a result means, a test can work cases by hand, and a student can be shown
 * how a number was reached. Two implementations of one rule drift unless
 * something holds them together, so `fixtures.json` is read by both this
 * file's test and `supabase/degree-audit.check.sql`, and each must reproduce
 * every expected result exactly. A change to the rule changes the fixtures
 * and both sides, or one of the two goes red.
 *
 * It is not `lib/degree.ts`, which is a calculator over requirements a
 * student types in and stays that. The arithmetic is the same on purpose:
 * double counting is allowed and every requirement says which courses it
 * counted, in progress is not done and is reported separately, an empty
 * `accepts` means anything, and a bare uppercase prefix such as ECON accepts
 * every ECON course.
 *
 * ## What it reads, and what it will not guess
 *
 * Ledger lines of four kinds (enrollment, grade, credit, transfer_credit),
 * the entry in effect on a date for each key. A key is `<course code> · <term>`;
 * a grade counts as done only if it is on the program's own passing list, in
 * the order the school wrote it; hours come from a `credit` entry or the
 * transfer value and are never assumed. A line it cannot use is listed as not
 * counted, with the reason, and never dropped quietly.
 *
 * ASCII course codes only: SQL's `upper` and JavaScript's `toUpperCase` agree
 * there and need not elsewhere.
 */

import { asOf as ledgerAsOf, type LedgerEntry } from '../record/ledger';

export type LineKind = 'enrollment' | 'grade' | 'credit' | 'transfer_credit';

/** The kinds of ledger entry an audit reads. The others are not used here, and the audit never says they are. */
export const READ_KINDS: readonly LineKind[] = ['enrollment', 'grade', 'credit', 'transfer_credit'];

/** One ledger line as the audit reads it: the entry in effect for a kind and key. */
export interface Line {
  kind: LineKind;
  key: string;
  value: string;
  effective_on: string;
  id: string;
}

export type Need = 'courses' | 'hours';

export interface RequirementInput {
  sort: number;
  name: string;
  need: Need;
  count: number;
  /** Tidied course codes or bare prefixes; empty means anything. */
  accepts: string[];
  min_grade: string | null;
}

export interface ProgramInput {
  /** Grades that complete a course, best first. */
  passing_grades: string[];
  requirements: RequirementInput[];
}

export type Source = 'course' | 'transfer';
export type CourseState = 'done' | 'in_progress' | 'not_counted';
export type NotCounted = 'no_course_code' | 'grade_not_passing' | 'no_grade_or_enrollment' | 'hours_unreadable';

export interface Item {
  key: string;
  code: string;
  term: string;
  source: Source;
  grade: string | null;
  hours: number | null;
}

export interface Unmet extends Item {
  why: 'below_minimum' | 'no_grade';
}

export interface RequirementResult {
  sort: number;
  name: string;
  need: Need;
  count: number;
  min_grade: string | null;
  accepts: string[];
  /** Courses or hours finished and counted. */
  have: number;
  /** Finished plus in progress. */
  will_have: number;
  /** Still to find after in-progress work. Never negative. */
  left: number;
  /** Finished work alone meets it. */
  met: boolean;
  /** Not met, and in-progress work would meet it. */
  meets_after: boolean;
  done: Item[];
  doing: Item[];
  /** Finished, accepted, and kept out only by the minimum grade. */
  unmet_grade: Unmet[];
}

export interface CourseResult extends Item {
  state: CourseState;
  reason: NotCounted | null;
  /** Every requirement that counted it, so double counting is stated. */
  counted_in: string[];
}

export type Verdict = 'complete' | 'complete_if_in_progress_passes' | 'incomplete';

export interface AuditResult {
  verdict: Verdict;
  requirements: RequirementResult[];
  courses: CourseResult[];
}

const SEP = ' · ';
const HOURS = /^[0-9]{1,3}(\.[0-9]{1,2})?$/;

/** A course code as the audit compares it: trimmed, upper-cased, spaces collapsed. */
export function tidy(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Byte order, as the database sorts with collation "C", for the characters a course key holds. */
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

// Hours and counts are summed in hundredths, because the database sums
// numeric(6,2) exactly and 0.1 + 0.2 is not 0.3 in a double.
const hundredths = (n: number): number => Math.round(n * 100);
const fromHundredths = (c: number): number => c / 100;

function readHours(value: string | undefined): number | null {
  return value !== undefined && HOURS.test(value) ? fromHundredths(hundredths(Number(value))) : null;
}

function split(key: string): { code: string; term: string } {
  const at = key.indexOf(SEP);
  return { code: tidy(at < 0 ? key : key.slice(0, at)), term: at < 0 ? '' : key.slice(at + SEP.length) };
}

/** Whether a requirement's `accepts` takes a course code. Empty means anything. */
export function accepts(list: readonly string[], code: string): boolean {
  if (list.length === 0) return true;
  return list.some((w) => w === code || (/^[A-Z]+$/.test(w) && code.startsWith(`${w} `)));
}

/** The lines as one string; its SHA-256 is what an audit keeps as the digest of its inputs. */
export function inputsText(lines: readonly Line[]): string {
  return [...lines]
    .sort((a, b) => cmp(a.kind, b.kind) || cmp(a.key, b.key))
    .map((l) => [l.kind, l.key, l.value, l.effective_on, l.id].join('\t'))
    .join('\n');
}

interface Instance extends Item {
  state: CourseState;
  reason: NotCounted | null;
}

function instances(passing: readonly string[], lines: readonly Line[]): Instance[] {
  const seen = new Set<string>();
  for (const l of lines) {
    const k = `${l.kind}\u0000${l.key}`;
    if (seen.has(k)) throw new Error('an audit reads one ledger line for each kind and key');
    seen.add(k);
  }
  const of = (kind: LineKind, key: string): Line | undefined => lines.find((l) => l.kind === kind && l.key === key);
  const out: Instance[] = [];
  const keys = [...new Set(lines.filter((l) => l.kind === 'enrollment' || l.kind === 'grade' || l.kind === 'credit').map((l) => l.key))];
  for (const key of keys) {
    const { code, term } = split(key);
    const grade = of('grade', key)?.value ?? null;
    const enrolled = of('enrollment', key) !== undefined;
    const hours = readHours(of('credit', key)?.value);
    let state: CourseState;
    let reason: NotCounted | null = null;
    if (code === '') {
      state = 'not_counted';
      reason = 'no_course_code';
    } else if (grade !== null) {
      state = passing.includes(grade) ? 'done' : 'not_counted';
      if (state === 'not_counted') reason = 'grade_not_passing';
    } else if (enrolled) {
      state = 'in_progress';
    } else {
      state = 'not_counted';
      reason = 'no_grade_or_enrollment';
    }
    out.push({ key, code, term, source: 'course', grade, hours, state, reason });
  }
  for (const l of lines) {
    if (l.kind !== 'transfer_credit') continue;
    const { code, term } = split(l.key);
    const hours = readHours(l.value);
    let state: CourseState = 'done';
    let reason: NotCounted | null = null;
    if (code === '') {
      state = 'not_counted';
      reason = 'no_course_code';
    } else if (hours === null) {
      state = 'not_counted';
      reason = 'hours_unreadable';
    }
    out.push({ key: l.key, code, term, source: 'transfer', grade: null, hours, state, reason });
  }
  return out.sort((a, b) => cmp(a.key, b.key) || cmp(a.source, b.source));
}

const item = (i: Instance): Item => ({ key: i.key, code: i.code, term: i.term, source: i.source, grade: i.grade, hours: i.hours });

/** Audits a record against a program: what is done, what is in progress, what is left, and where each course counted. */
export function audit(program: ProgramInput, lines: readonly Line[]): AuditResult {
  const passing = program.passing_grades;
  const all = instances(passing, lines);
  const reqs: RequirementResult[] = [];
  for (const r of [...program.requirements].sort((a, b) => a.sort - b.sort)) {
    if (r.min_grade !== null && !passing.includes(r.min_grade)) {
      throw new Error('a minimum grade must be one of the program’s passing grades');
    }
    const minRank = r.min_grade === null ? null : passing.indexOf(r.min_grade);
    const eligible = all.filter((i) => (i.state === 'done' || i.state === 'in_progress') && accepts(r.accepts, i.code));
    // A transfer has no grade, so a requirement with a minimum grade never counts one.
    const meetsMin = (i: Instance): boolean =>
      minRank === null || (i.source === 'course' && i.grade !== null && passing.indexOf(i.grade) <= minRank);
    const counted = eligible.filter((i) => i.state === 'done' && meetsMin(i));
    const doing = eligible.filter((i) => i.state === 'in_progress');
    const unmet = eligible.filter((i) => i.state === 'done' && !meetsMin(i));
    const amount = (list: Instance[]): number => list.reduce((n, i) => n + (r.need === 'hours' ? hundredths(i.hours ?? 0) : 100), 0);
    const have = amount(counted);
    const willHave = have + amount(doing);
    const need = hundredths(r.count);
    const met = have >= need;
    reqs.push({
      sort: r.sort,
      name: r.name,
      need: r.need,
      count: r.count,
      min_grade: r.min_grade,
      accepts: r.accepts,
      have: fromHundredths(have),
      will_have: fromHundredths(willHave),
      left: fromHundredths(Math.max(0, need - willHave)),
      met,
      meets_after: !met && willHave >= need,
      done: counted.map(item),
      doing: doing.map(item),
      unmet_grade: unmet.map((i) => ({ ...item(i), why: i.source === 'course' ? ('below_minimum' as const) : ('no_grade' as const) })),
    });
  }
  const courses: CourseResult[] = all.map((i) => ({
    ...item(i),
    state: i.state,
    reason: i.reason,
    counted_in: reqs.filter((q) => [...q.done, ...q.doing].some((z) => z.key === i.key && z.source === i.source)).map((q) => q.name),
  }));
  const verdict: Verdict =
    reqs.length > 0 && reqs.every((q) => q.met)
      ? 'complete'
      : reqs.length > 0 && reqs.every((q) => q.met || q.meets_after)
        ? 'complete_if_in_progress_passes'
        : 'incomplete';
  return { verdict, requirements: reqs, courses };
}

/**
 * The record as the audit reads it on a date: for each kind and key the entry
 * in effect (`asOf` in `lib/record/ledger.ts`, the ledger's own order), a
 * removal meaning the key is absent, and only the four kinds above.
 */
export function linesAsOf(entries: readonly LedgerEntry[], on: string): Line[] {
  return ledgerAsOf(entries, on)
    .filter((l) => (READ_KINDS as readonly string[]).includes(l.kind))
    .map((l) => ({ kind: l.kind as LineKind, key: l.subject_key, value: l.value, effective_on: l.effective_on, id: l.entry.id }))
    .sort((a, b) => cmp(a.kind, b.kind) || cmp(a.key, b.key));
}
