/**
 * The transcript body, built from a head and the ledger lines in effect.
 *
 * The TypeScript twin of `private.transcript_build`. It reads nothing but its
 * two arguments, as the SQL function reads nothing but its own, and
 * `fixtures.json` is what both must reproduce. It decides nothing about a
 * record: grades, credit and enrolment are the ledger's text as it is, and the
 * only reading it does is splitting a key `<course> · <term>` at its first
 * " · ", which is the form the record screen's own hint asks for.
 *
 * Terms are sorted by their bytes, not by a calendar, because the ledger holds
 * no calendar. A school that wants "Spring" before "Fall" has to say so in its
 * keys; this does not guess.
 */
import type { LedgerEntry, RecordKind } from '../record/ledger';
import { asOf as ledgerAsOf } from '../record/ledger';
import { byBytes, canonicalize, sha256Hex } from './canonical';

/** The kinds a transcript reads. `requirement` entries are not read. */
export const READ_KINDS = ['enrollment', 'grade', 'credit', 'transfer_credit', 'standing', 'conferral'] as const;
export type ReadKind = (typeof READ_KINDS)[number];

export const FORMAT = 'semester-transcript-body-1';
export const NOTICE = 'This text is not signed. Its SHA-256 shows that it has not changed since it was issued; it does not show who issued it.';

/** The first " · " in a key splits the course from the term. */
export const SEPARATOR = ' · ';

export interface Head {
  serial: string;
  school_id: string;
  school_name: string;
  student_ref: string;
  as_of: string;
}

export interface Line {
  kind: ReadKind;
  key: string;
  value: string;
  effective_on: string;
}

export interface CourseLine {
  course: string;
  key: string;
  enrollment: string;
  grade: string;
  credit: string;
}

export interface TermBlock {
  term: string;
  courses: CourseLine[];
}

export interface KeyedLine {
  key: string;
  value: string;
  effective_on: string;
}

export interface Body {
  format: typeof FORMAT;
  notice: string;
  serial: string;
  school: { id: string; name: string };
  student_ref: string;
  as_of: string;
  includes: ReadKind[];
  terms: TermBlock[];
  transfer_credit: KeyedLine[];
  standing: KeyedLine[];
  conferrals: KeyedLine[];
}

/** Why a set of lines cannot be a transcript, in the database's own words. */
export const ONE_LINE_EACH = 'a transcript reads one ledger line for each kind and key';

export function buildBody(head: Head, lines: readonly Line[]): Body {
  const seen = new Set<string>();
  for (const l of lines) {
    const id = JSON.stringify([l.kind, l.key]);
    if (seen.has(id)) throw new Error(ONE_LINE_EACH);
    seen.add(id);
  }
  const value = (kind: ReadKind, key: string): string => lines.find((l) => l.kind === kind && l.key === key)?.value ?? '';

  const keys = [...new Set(lines.filter((l) => l.kind === 'enrollment' || l.kind === 'grade' || l.kind === 'credit').map((l) => l.key))];
  const byTerm = new Map<string, CourseLine[]>();
  for (const key of keys) {
    const at = key.indexOf(SEPARATOR);
    const course = at >= 0 ? key.slice(0, at) : key;
    const term = at >= 0 ? key.slice(at + SEPARATOR.length) : '';
    const one: CourseLine = { course, key, enrollment: value('enrollment', key), grade: value('grade', key), credit: value('credit', key) };
    byTerm.set(term, [...(byTerm.get(term) ?? []), one]);
  }
  const terms = [...byTerm.entries()]
    .sort(([a], [b]) => byBytes(a, b))
    .map(([term, courses]) => ({ term, courses: courses.sort((a, b) => byBytes(a.key, b.key)) }));

  const keyed = (kind: ReadKind): KeyedLine[] =>
    lines
      .filter((l) => l.kind === kind)
      .map((l) => ({ key: l.key, value: l.value, effective_on: l.effective_on }))
      .sort((a, b) => byBytes(a.key, b.key));

  return {
    format: FORMAT,
    notice: NOTICE,
    serial: head.serial,
    school: { id: head.school_id, name: head.school_name },
    student_ref: head.student_ref,
    as_of: head.as_of,
    includes: [...READ_KINDS],
    terms,
    transfer_credit: keyed('transfer_credit'),
    standing: keyed('standing'),
    conferrals: keyed('conferral'),
  };
}

/** The ledger lines a transcript as of `on` reads: the entry in effect for each key, a void meaning absent, and only the kinds above. */
export function linesAsOf(entries: readonly LedgerEntry[], on: string): Line[] {
  return ledgerAsOf(entries, on)
    .filter((l) => (READ_KINDS as readonly RecordKind[]).includes(l.kind))
    .map((l) => ({ kind: l.kind as ReadKind, key: l.subject_key, value: l.value, effective_on: l.effective_on }));
}

/** Body, canonical text and hash, together: what one issue stores. */
export async function seal(head: Head, lines: readonly Line[]): Promise<{ body: Body; text: string; sha256: string }> {
  const body = buildBody(head, lines);
  const text = canonicalize(body);
  return { body, text, sha256: await sha256Hex(text) };
}
