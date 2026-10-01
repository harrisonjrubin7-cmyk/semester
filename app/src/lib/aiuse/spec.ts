/**
 * The school-level AI use policy, in TypeScript: the closed lists, the answer
 * every AI entry point must ask for, and the register of the entry points there are.
 *
 * `supabase/migrations/20260930290000_ai_governance.sql` is the authority. A
 * school says, per Core module and data class, whether AI may be used on that
 * module's data; the default is no; and five classes are never permitted, in any
 * school, whatever any row says (D-1063). `public.ai_use_permitted` answers and
 * logs each question. This file carries the same lists so a test can hold the two
 * equal, and the same decision as a pure function so the SQL's order of checks
 * can be walked without a database.
 *
 * DO-NOT-BUILD rule 3 is why the never classes exist: Semester is a calculator
 * over facts a school supplies, and AI never decides. Grades, admissions
 * decisions and aid amounts are exactly where a decision is made about a person.
 *
 * Nothing here calls a model, stores a prompt or a response, or ranks anything.
 */

/** AI is never permitted on these, at any school. Closed: a school cannot override it. */
export const NEVER_CLASSES = [
  'grade_or_transcript', 'admissions_decision', 'aid_amount', 'disciplinary', 'health',
] as const;
export type NeverClass = (typeof NEVER_CLASSES)[number];

/** The only classes a school's policy can ever name. */
export const PERMITTABLE_CLASSES = [
  'catalog_public', 'schedule_structure', 'instructor_material',
  'requesters_own_work', 'deidentified_aggregate',
] as const;
export type PermittableClass = (typeof PERMITTABLE_CLASSES)[number];

export const CLASS_WORDS: Record<NeverClass | PermittableClass, string> = {
  grade_or_transcript: 'Grades and transcript content',
  admissions_decision: 'Admissions decisions',
  aid_amount: 'Financial aid amounts',
  disciplinary: 'Disciplinary records',
  health: 'Health data',
  catalog_public: 'Published catalog information',
  schedule_structure: 'Course and section times, without who is in them',
  instructor_material: 'Material an instructor wrote for a course',
  requesters_own_work: 'The asking person’s own work',
  deidentified_aggregate: 'De-identified counts',
};

export const REASONS = [
  'never_class', 'unknown_module', 'unknown_class', 'kill_switch',
  'no_policy', 'denied_by_school', 'permitted_by_school',
] as const;
export type Reason = (typeof REASONS)[number];

export const REASON_WORDS: Record<Reason, string> = {
  never_class: 'Semester never allows AI on this kind of data, at any school.',
  unknown_module: 'That is not a Core module.',
  unknown_class: 'That is not a kind of data a school can allow AI on.',
  kill_switch: 'AI generation is switched off for this school.',
  no_policy: 'The school has not allowed AI here. The default is no.',
  denied_by_school: 'The school has turned AI off here.',
  permitted_by_school: 'The school has allowed AI on this, with two people agreeing.',
};

export interface Question {
  module: string;
  dataClass: string;
  /** `kill.ai_generation` is engaged for the school or globally. */
  killed: boolean;
  /** The school's latest approved answer for this module and class, or null if it has given none. */
  policy: boolean | null;
}

/** The SQL's order of checks. The first that applies wins; a school's yes is the last. */
export function decide(q: Question, coreModules: readonly string[]): { allowed: boolean; reason: Reason } {
  const m = q.module.trim().toLowerCase();
  const c = q.dataClass.trim().toLowerCase();
  const deny = (reason: Reason) => ({ allowed: false, reason });
  if ((NEVER_CLASSES as readonly string[]).includes(c)) return deny('never_class');
  if (!coreModules.includes(m)) return deny('unknown_module');
  if (!(PERMITTABLE_CLASSES as readonly string[]).includes(c)) return deny('unknown_class');
  if (q.killed) return deny('kill_switch');
  if (q.policy === null) return deny('no_policy');
  return q.policy ? { allowed: true, reason: 'permitted_by_school' } : deny('denied_by_school');
}

/**
 * What an entry point makes of the database's answer. Anything that is not
 * exactly one row saying allowed with `permitted_by_school` is a no: a failed
 * call, an empty answer, a malformed one.
 */
export function readAnswer(data: unknown): { allowed: boolean; reason: Reason | 'unavailable' } {
  const row = Array.isArray(data) && data.length === 1 ? (data[0] as Record<string, unknown> | null) : null;
  if (!row || typeof row !== 'object') return { allowed: false, reason: 'unavailable' };
  const reason = REASONS.find((r) => r === row.reason);
  if (!reason) return { allowed: false, reason: 'unavailable' };
  return { allowed: row.allowed === true && reason === 'permitted_by_school', reason };
}

/**
 * Every file that sends something to a model, and what it may send. A file that
 * reaches a provider and is not here is red (`aiuse.test.ts`), so a new route to
 * a model cannot arrive without somebody writing down whether it touches a Core
 * module's data. Today none does: `touchesCoreData` is false for all four, and the
 * test holds that by refusing any of these files, or `app/src/ai/`, to import a
 * Core module's code. The day one does, it calls `ai_use_permitted` first.
 */
export interface EntryPoint {
  path: string;
  touchesCoreData: false;
  what: string;
}

export const ENTRY_POINTS: readonly EntryPoint[] = [
  {
    path: 'app/src/lib/claude.ts',
    touchesCoreData: false,
    what: 'The student’s own Anthropic key, from their own device. It sends what the Ask tab assembles from the student’s own planner; no Core module’s tables are read by it.',
  },
  {
    path: 'app/src/lib/openai.ts',
    touchesCoreData: false,
    what: 'The student’s own OpenAI key, from their own device, with the same context as the Ask tab.',
  },
  {
    path: 'supabase/functions/claude/index.ts',
    touchesCoreData: false,
    what: 'The shared-key relay. It serves nobody until the owner’s provider decisions are recorded (D-1031), has no school, and reads no table of a Core module; it forwards what a signed-in account sends.',
  },
  {
    path: 'app/server/institution/providers/openai.ts',
    touchesCoreData: false,
    what: 'The institution gateway’s provider. It is handed only course sources the school approved (`approved_source`), never a Core module’s records.',
  },
];

/** Where a Core module’s code lives in `app/src/lib`. Importing one from an AI path needs the gate first. */
export const CORE_MODULE_LIBS = [
  'advancement', 'assessment', 'assignments', 'admissions', 'aid', 'degreeaudit', 'dining',
  'enrollment', 'finance', 'gradebook', 'k12', 'record', 'scheduling', 'transcripts',
] as const;
