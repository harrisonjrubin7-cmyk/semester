/**
 * The credit-preparation workspace: what a transfer student brings, what it
 * might count as here, and the packet they take to the official evaluation.
 *
 * `lib/transferhub.ts` names this as the hub's missing workflow — "the tables
 * exist; no screen lists prior courses, maps them against a published pathway
 * or assembles a packet." This is that screen's logic.
 *
 * ## It decides nothing
 *
 * Only the receiving school evaluates transfer credit. So every course here
 * carries one of the four labels brief §14 insists on, and none of them is
 * "transfers":
 *
 *   - **Published equivalency** — the school's own approved articulation rule
 *     says this course maps to that one. Still confirmed by the official
 *     evaluation of the student's transcript; a rule is a promise about a
 *     course, not a decision about a student.
 *   - **Estimated equivalent** — the student's own guess, or a match against a
 *     pathway file they imported. Semester has not checked either.
 *   - **Pending review** — the student says the packet went in.
 *   - **Not evaluated** — nothing yet.
 *
 * ## Where the published rules come from
 *
 * `articulation_rules` rows with `status = 'approved'` at the student's own
 * school, read under the table's own policy (students at the school read the
 * approved rows and nothing else). A student who is not signed in, or whose
 * school has published none, works from what they type or import — which is
 * why the imported rows are labelled `imported` and never
 * `institution_verified`.
 *
 * Device-first under `semester.transfer-credit.v1`, like the registration
 * workspace. It writes nothing to `transfer_evaluations`: the official
 * evaluation belongs to the institution, and a student-side row would be a
 * second copy of a decision nobody here makes.
 */

import { obj, textValue } from './device-library';

export const TRANSFER_CREDIT_KEY = 'semester.transfer-credit.v1';
export const MAX_COURSES = 80;
export const MAX_RULES = 1000;

export interface PriorCourse {
  id: string;
  institution: string;
  code: string;
  title: string;
  credits: number;
  grade: string;
  term: string;
}

export type RuleSource = 'institution_verified' | 'imported';

export interface Rule {
  fromInstitution: string;
  fromCourse: string;
  toCourse: string;
  credits: number | null;
  source: RuleSource;
}

export interface Guess {
  toCourse: string;
  note: string;
}

export interface TransferCreditData {
  courses: PriorCourse[];
  /** Imported pathway rows only. Published rules are read fresh, never stored. */
  imported: Rule[];
  guesses: Record<string, Guess>;
  /** `YYYY-MM-DD` the student says the packet went in, or null. */
  submittedOn: string | null;
  documents: string[];
}

export const EMPTY_TRANSFER_CREDIT: TransferCreditData = {
  courses: [],
  imported: [],
  guesses: {},
  submittedOn: null,
  documents: [],
};

export const DOCUMENTS: { id: string; label: string; why: string }[] = [
  {
    id: 'transcript',
    label: 'Official transcript ordered from every previous school',
    why: 'The evaluation is done from the official transcript, sent school to school — not a screenshot or an unofficial copy.',
  },
  {
    id: 'descriptions',
    label: 'Course descriptions or syllabi for anything without a published equivalency',
    why: 'Evaluators decide unmatched courses from what the course covered. A syllabus from the term you took it is best.',
  },
  {
    id: 'exams',
    label: 'AP, IB, CLEP or other exam scores sent',
    why: 'Exam credit is sent by the testing agency, not by your old school.',
  },
  {
    id: 'military',
    label: 'Joint Services Transcript, if you served',
    why: 'Military training can carry credit and arrives on its own transcript.',
  },
  {
    id: 'deadline',
    label: 'Checked the evaluation deadline for my first registration',
    why: 'An evaluation that lands after your registration window means registering without knowing what counts.',
  },
];

export type Status = 'published' | 'estimated' | 'pending_review' | 'not_evaluated';

export const STATUS_TEXT: Record<Status, string> = {
  published: 'Published equivalency',
  estimated: 'Estimated equivalent',
  pending_review: 'Pending review',
  not_evaluated: 'Not evaluated',
};

export const STATUS_MEANING: Record<Status, string> = {
  published: 'Your school has published this equivalency. Your official evaluation still confirms it for you.',
  estimated: 'Your own match, or one from a file you imported. Not checked by your school.',
  pending_review: 'You have sent this for official evaluation. Wait for the school’s decision.',
  not_evaluated: 'No equivalency yet. Include a description or syllabus in your packet.',
};

const COURSE_ID = /^[a-z0-9-]{1,60}$/;

/** `CSC-1010`, `csc 1010` and ` CSC1010 ` are one course. */
export function normalCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** `Nashville State CC`, `nashville-state-cc` and a partner scope's last segment compare equal. */
export function normalInstitution(name: string): string {
  const last = name.includes('/') ? name.slice(name.lastIndexOf('/') + 1) : name;
  return last.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const credits = (v: unknown, allowNull: boolean): v is number | null =>
  (allowNull && v === null) || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 30);

function readRule(v: unknown): Rule {
  if (
    !obj(v) ||
    !textValue(v.fromInstitution, 200) ||
    !v.fromInstitution.trim() ||
    !textValue(v.fromCourse, 60) ||
    !v.fromCourse.trim() ||
    !textValue(v.toCourse, 60) ||
    !v.toCourse.trim() ||
    !credits(v.credits, true)
  ) {
    throw new Error('A saved pathway row is not valid.');
  }
  // Nothing stored is ever institution verified: published rules are read
  // fresh from the school, so a stored row claiming to be one is refused.
  if (v.source !== 'imported') throw new Error('A saved pathway row claims to be published.');
  return {
    fromInstitution: v.fromInstitution,
    fromCourse: v.fromCourse,
    toCourse: v.toCourse,
    credits: v.credits as number | null,
    source: 'imported',
  };
}

export function readTransferCredit(value: unknown): TransferCreditData {
  if (!obj(value) || !Array.isArray(value.courses) || !Array.isArray(value.imported) || !obj(value.guesses)) {
    throw new Error('Saved transfer credit is not valid.');
  }
  if (value.courses.length > MAX_COURSES || value.imported.length > MAX_RULES) {
    throw new Error('Saved transfer credit is too large.');
  }
  const courses = value.courses.map((c): PriorCourse => {
    if (
      !obj(c) ||
      !textValue(c.id, 60) ||
      !COURSE_ID.test(c.id) ||
      !textValue(c.institution, 200) ||
      !c.institution.trim() ||
      !textValue(c.code, 60) ||
      !c.code.trim() ||
      !textValue(c.title, 200) ||
      !credits(c.credits, false) ||
      !textValue(c.grade, 10) ||
      !textValue(c.term, 40)
    ) {
      throw new Error('A saved prior course is not valid.');
    }
    return {
      id: c.id,
      institution: c.institution,
      code: c.code,
      title: c.title,
      credits: c.credits as number,
      grade: c.grade,
      term: c.term,
    };
  });
  if (new Set(courses.map((c) => c.id)).size !== courses.length) throw new Error('Prior course ids must be unique.');
  const ids = new Set(courses.map((c) => c.id));
  const guesses: Record<string, Guess> = {};
  for (const [id, g] of Object.entries(value.guesses)) {
    if (!ids.has(id)) continue;
    if (!obj(g) || !textValue(g.toCourse, 60) || !textValue(g.note, 500)) throw new Error('A saved guess is not valid.');
    if (g.toCourse.trim() || g.note.trim()) guesses[id] = { toCourse: g.toCourse, note: g.note };
  }
  const submittedOn = value.submittedOn;
  if (submittedOn !== null && !(textValue(submittedOn, 10) && /^\d{4}-\d{2}-\d{2}$/.test(submittedOn))) {
    throw new Error('Saved submission date is not valid.');
  }
  if (!Array.isArray(value.documents)) throw new Error('Saved document checklist is not valid.');
  const known = new Set(DOCUMENTS.map((d) => d.id));
  const documents = [...new Set(value.documents.filter((d): d is string => typeof d === 'string' && known.has(d)))];
  return { courses, imported: value.imported.map(readRule), guesses, submittedOn, documents };
}

export function newCourseId(taken: PriorCourse[], random: () => number = Math.random): string {
  const used = new Set(taken.map((c) => c.id));
  for (;;) {
    const id = `p${Math.floor(random() * 36 ** 8).toString(36)}`;
    if (!used.has(id)) return id;
  }
}

/**
 * The best rule for one prior course: a published one before an imported
 * one, and only a rule naming the same institution and the same course.
 */
export function ruleFor(course: PriorCourse, rules: Rule[]): Rule | null {
  const inst = normalInstitution(course.institution);
  const code = normalCode(course.code);
  const matches = rules.filter((r) => normalCode(r.fromCourse) === code && normalInstitution(r.fromInstitution) === inst);
  return matches.find((r) => r.source === 'institution_verified') ?? matches[0] ?? null;
}

export interface Evaluated {
  course: PriorCourse;
  status: Status;
  /** What it might count as here, or null. */
  toCourse: string | null;
  rule: Rule | null;
  guess: Guess | null;
}

export function evaluate(data: TransferCreditData, published: Rule[]): Evaluated[] {
  const rules = [...published, ...data.imported];
  return data.courses.map((course) => {
    const rule = ruleFor(course, rules);
    const guess = data.guesses[course.id] ?? null;
    const toCourse = rule?.toCourse ?? (guess?.toCourse.trim() || null);
    let status: Status = 'not_evaluated';
    if (rule?.source === 'institution_verified') status = 'published';
    else if (toCourse) status = 'estimated';
    // Sent for evaluation outranks every label but a published rule: the
    // student's own guess is now a question the school is answering.
    if (data.submittedOn && status !== 'published') status = 'pending_review';
    return { course, status, toCourse, rule, guess };
  });
}

export interface Totals {
  courses: number;
  credits: number;
  byStatus: Record<Status, { courses: number; credits: number }>;
}

export function totals(rows: Evaluated[]): Totals {
  const byStatus = {
    published: { courses: 0, credits: 0 },
    estimated: { courses: 0, credits: 0 },
    pending_review: { courses: 0, credits: 0 },
    not_evaluated: { courses: 0, credits: 0 },
  } as Record<Status, { courses: number; credits: number }>;
  for (const r of rows) {
    byStatus[r.status].courses += 1;
    byStatus[r.status].credits += r.course.credits;
  }
  return {
    courses: rows.length,
    credits: rows.reduce((n, r) => n + r.course.credits, 0),
    byStatus,
  };
}

/**
 * Read a pathway file: CSV with a header naming `from_institution`,
 * `from_course`, `to_course` and optionally `credits`. Quoted fields are
 * supported because course titles and institution names have commas in them.
 */
export function parsePathway(text: string): Rule[] {
  if (text.length > 1_000_000) throw new Error('Use a pathway file smaller than 1 MB.');
  const rows = csvRows(text).filter((r) => r.some((c) => c.trim()));
  if (rows.length < 2) throw new Error('The file needs a header row and at least one pathway row.');
  const head = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const at = (name: string) => head.indexOf(name);
  const fi = at('from_institution');
  const fc = at('from_course');
  const tc = at('to_course');
  const cr = at('credits');
  if (fi < 0 || fc < 0 || tc < 0) {
    throw new Error('The header must name from_institution, from_course and to_course.');
  }
  const out: Rule[] = [];
  for (const [n, r] of rows.slice(1).entries()) {
    const fromInstitution = (r[fi] ?? '').trim();
    const fromCourse = (r[fc] ?? '').trim();
    const toCourse = (r[tc] ?? '').trim();
    if (!fromInstitution || !fromCourse || !toCourse) throw new Error(`Row ${n + 2} is missing an institution or a course.`);
    if (fromInstitution.length > 200 || fromCourse.length > 60 || toCourse.length > 60) {
      throw new Error(`Row ${n + 2} has a value that is too long.`);
    }
    const raw = cr >= 0 ? (r[cr] ?? '').trim() : '';
    const value = raw === '' ? null : Number(raw);
    if (value !== null && !(Number.isFinite(value) && value >= 0 && value <= 30)) {
      throw new Error(`Row ${n + 2} has credits that are not a number between 0 and 30.`);
    }
    out.push({ fromInstitution, fromCourse, toCourse, credits: value, source: 'imported' });
  }
  if (out.length > MAX_RULES) throw new Error(`A pathway file can hold at most ${MAX_RULES} rows.`);
  return out;
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

/** The questions worth asking an advisor or the transfer office. */
export function questions(rows: Evaluated[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    const name = `${r.course.code} (${r.course.institution})`;
    if (r.status === 'not_evaluated') out.push(`How will ${name} be evaluated, and what do you need from me to decide it?`);
    else if (r.status === 'estimated' && r.toCourse) out.push(`Will ${name} count as ${r.toCourse}?`);
  }
  return out;
}

/**
 * The plain-text packet: every course with its label, the questions, and the
 * documents checklist. It says at the top that it is a request, not a result.
 */
export function packet(data: TransferCreditData, rows: Evaluated[], school: string | null): string {
  const t = totals(rows);
  const lines = [
    `Transfer credit evaluation request${school ? ` — ${school}` : ''}`,
    'Prepared in Semester. This is a request for official evaluation, not a decision about credit.',
    '',
    `Prior courses: ${t.courses} · ${t.credits} credits`,
    '',
    ...rows.map((r) => {
      const to = r.toCourse ? ` → ${r.toCourse}` : '';
      const grade = r.course.grade ? `, grade ${r.course.grade}` : '';
      const term = r.course.term ? `, ${r.course.term}` : '';
      const note = r.guess?.note.trim() ? ` — note: ${r.guess.note.trim()}` : '';
      return `• ${r.course.code} ${r.course.title} (${r.course.institution}${term}, ${r.course.credits} cr${grade})${to} [${STATUS_TEXT[r.status]}]${note}`;
    }),
  ];
  const q = questions(rows);
  if (q.length) lines.push('', 'Questions', ...q.map((x) => `• ${x}`));
  lines.push(
    '',
    'Documents',
    ...DOCUMENTS.map((d) => `${data.documents.includes(d.id) ? '[x]' : '[ ]'} ${d.label}`),
  );
  return lines.join('\n');
}

/**
 * A row as `articulation_rules` returns it. The policy lets a student at the
 * school read only `approved` rows there, and the query asks for those alone
 * as well, so a policy change that widened the read could not widen this.
 */
export interface PublishedRow {
  partner_scope: string;
  from_course: string;
  to_course: string;
  credits: number | string | null;
  status: string;
}

/**
 * Turn published rows into rules. Anything not `approved` is dropped here too:
 * a proposed equivalency is a partner's suggestion, and labelling it
 * "published" would be the one lie this screen exists not to tell.
 */
export function fromPublished(rows: PublishedRow[]): Rule[] {
  return rows
    .filter((r) => r.status === 'approved')
    .map((r) => {
      const n = r.credits === null ? null : Number(r.credits);
      return {
        fromInstitution: r.partner_scope,
        fromCourse: r.from_course,
        toCourse: r.to_course,
        credits: n !== null && Number.isFinite(n) ? n : null,
        source: 'institution_verified' as const,
      };
    });
}
