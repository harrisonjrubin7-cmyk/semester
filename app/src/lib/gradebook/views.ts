/**
 * The two readings of a gradebook that leave the instructor's hands: what a
 * student is shown, and the file the registrar is sent.
 *
 * Both are built from `releasedFor`, and neither has another way in. A
 * student's view is theirs alone — asked for by a student id, it holds
 * nothing about anybody else — and the registrar's file holds only what every
 * student in it has already been shown.
 */
import { finalGrade, schemeProblems, type FinalGrade } from './compute';
import { releasedFor } from './ledger';
import { holds, refuse, type Actor, type Decision, type Gradebook, type Mark, type RegradeResolution } from './model';

export interface StudentLine {
  itemId: string;
  title: string;
  pointsPossible: number;
  score: number | null;
  mark: Mark | null;
  comment: string;
  releasedAt: string;
}

export interface StudentView {
  lines: StudentLine[];
  final: FinalGrade;
  /** The student's own regrade requests, each with its answer once there is one. */
  regrades: { id: string; itemId: string; reason: string; resolution: Pick<RegradeResolution, 'outcome' | 'note'> | null }[];
}

/**
 * What `viewer` sees of this course: their own released grades and nothing
 * else. There is deliberately no parameter naming a different student.
 */
export function studentView(book: Gradebook, viewer: Actor): StudentView {
  const released = releasedFor(book, viewer.id);
  const lines = released.map((e) => {
    const it = book.items.find((i) => i.id === e.itemId)!;
    return { itemId: e.itemId, title: it.title, pointsPossible: it.pointsPossible, score: e.score, mark: e.mark, comment: e.comment, releasedAt: e.at };
  });
  const regrades = book.regrades
    .filter((r) => r.studentId === viewer.id)
    .map((r) => {
      const res = book.resolutions.find((x) => x.requestId === r.id);
      return { id: r.id, itemId: r.itemId, reason: r.reason, resolution: res ? { outcome: res.outcome, note: res.note } : null };
    });
  return { lines, final: finalGrade(book.scheme, book.items, released), regrades };
}

export interface RosterName {
  /** The registrar's own identifier for the student. */
  studentNumber: string;
  name: string;
}

/**
 * A cell as RFC 4180 writes it, and never as a formula: a spreadsheet runs
 * a cell starting `=`, `+`, `-` or `@`, and a student's name is not code.
 */
export function cell(v: string | number | null): string {
  let s = v === null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The registrar's file: one row per enrolled student, their final percentage
 * and letter from released grades only, and why.
 *
 * Refused when the scheme is not one — weights that do not sum to 100 would
 * put a wrong letter in the record of every student at once.
 */
export function registrarCsv(book: Gradebook, actor: Actor, names: Readonly<Record<string, RosterName>>): Decision<string> {
  if (!holds(actor, 'grades:export')) return refuse('not-authorised', 'The registrar export needs grades:export.');
  const problems = schemeProblems(book.scheme);
  if (problems.length) return refuse('bad-scheme', `The scheme cannot grade: ${problems.join(' ')}`);
  const rows = [['student_number', 'name', 'course', 'term', 'percent', 'letter', 'basis'].join(',')];
  const students = [...book.roster].sort((a, b) =>
    (names[a]?.studentNumber ?? a).localeCompare(names[b]?.studentNumber ?? b));
  for (const s of students) {
    const f = finalGrade(book.scheme, book.items, releasedFor(book, s));
    rows.push([
      cell(names[s]?.studentNumber ?? ''), cell(names[s]?.name ?? ''), cell(book.course), cell(book.term),
      cell(f.percent === null ? null : f.percent.toFixed(2)), cell(f.letter), cell(f.reason),
    ].join(','));
  }
  return { ok: true, value: `${rows.join('\r\n')}\r\n`, reason: `${students.length} students, released grades only.`, replayed: false };
}
