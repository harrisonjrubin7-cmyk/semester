import type { Action, Choice } from './actions';
import { toHash } from './route';

/**
 * Released feedback in the Action Center (B08 events → B14 Action Center),
 * against `supabase/migrations/20261022090000_grade_release_student_actions.sql`.
 *
 * When an instructor releases grades, the outbox relay writes one row per
 * student whose grade was released (`public.student_actions`). Unlike the rest
 * of the Action Center, these are stored on the server, because the fact they
 * come from — "your instructor released this grade" — is the school's, not the
 * device's. So their done and dismissed states are the server's too, moved by
 * `settle_student_action` against the version the student read; snoozing,
 * starting and notes stay on the device like every other action's.
 *
 * `my_student_actions()` returns open and dismissed rows only while each one
 * still names the student's latest released version of that item: a grade
 * changed and released again replaces the old action rather than sitting
 * beside it.
 */

export const FEEDBACK_PREFIX = 'feedback:';

export type StudentActionState = 'open' | 'done' | 'dismissed';

export interface StudentAction {
  id: string;
  itemId: string;
  gradeEntryId: string;
  courseCode: string;
  term: string;
  itemTitle: string;
  state: StudentActionState;
  version: number;
  releasedAt: number;
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const time = (v: unknown): number | null => {
  if (typeof v !== 'string' || !v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

/** A row from `my_student_actions()`, or null when anything the student is owed is missing. */
export function readStudentAction(row: unknown): StudentAction | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = text(r.id);
  const itemId = text(r.item_id);
  const gradeEntryId = text(r.grade_entry_id);
  const courseCode = text(r.course_code);
  const term = text(r.term);
  const itemTitle = text(r.item_title);
  const state = text(r.state) as StudentActionState;
  const version = typeof r.version === 'number' && Number.isInteger(r.version) && r.version >= 1 ? r.version : null;
  const releasedAt = time(r.released_at);
  if (text(r.kind) !== 'grade_released') return null;
  if (!id || !itemId || !gradeEntryId || !courseCode || !term || !itemTitle) return null;
  if (state !== 'open' && state !== 'dismissed') return null;
  if (version === null || releasedAt === null) return null;
  return { id, itemId, gradeEntryId, courseCode, term, itemTitle, state, version, releasedAt };
}

export function readStudentActions(data: unknown): StudentAction[] {
  return (Array.isArray(data) ? data : []).map(readStudentAction).filter((a): a is StudentAction => a !== null);
}

export const isFeedbackAction = (actionId: string) => actionId.startsWith(FEEDBACK_PREFIX);
export const feedbackRowId = (actionId: string) => actionId.slice(FEEDBACK_PREFIX.length);

/** One released grade, proposed to the Action Center like any other module's action. */
export function studentActionToAction(a: StudentAction): Action {
  return {
    id: `${FEEDBACK_PREFIX}${a.id}`,
    type: 'feedback',
    title: `Feedback released: ${a.itemTitle}`,
    whyItMatters: `${a.courseCode} released your grade and feedback. View your grade while the work is fresh.`,
    priority: 'normal',
    dueAt: null,
    expiresAt: null,
    group: 'Released feedback',
    source: {
      label: 'institution_verified',
      system: `${a.courseCode} gradebook · ${a.term}`,
      at: a.releasedAt,
      authority: 'Your instructor',
      dataOwner: 'Your instructor',
      correctionRoute: 'Ask for a regrade from your grade in the gradebook.',
    },
    explanation: {
      trigger: `Your instructor released your grade for ${a.itemTitle}.`,
      factors: [`${a.courseCode}, ${a.term}`, 'The grade shown is the latest one released to you.'],
      expectedImpact: 'You read the grade and comments while you still remember the work.',
      limitations: [
        'Semester shows that a grade was released. The gradebook is the record.',
        'If the grade is changed and released again, this is replaced by a new one.',
      ],
      alternatives: ['Ask your instructor about the feedback.', 'Dismiss it if you have already read it.'],
    },
    primary: { label: 'View your grade', kind: 'navigate', target: toHash({ screen: 'gradebook', id: '' }), requiresConfirmation: false },
  };
}

/**
 * The device's choices with the server's word on released feedback laid over
 * them. A row the server holds dismissed reads dismissed on every device; one
 * it holds open is not hidden by an old "done" or "dismissed" left on this
 * device. Snoozes and starts on open rows are the device's and stay.
 */
export function withServerState(choices: Record<string, Choice>, rows: readonly StudentAction[] | null): Record<string, Choice> {
  if (!rows || rows.length === 0) return choices;
  const next = { ...choices };
  for (const row of rows) {
    const key = `${FEEDBACK_PREFIX}${row.id}`;
    const local = next[key];
    if (row.state === 'dismissed') {
      next[key] = { status: 'dismissed', snoozedUntil: null, history: local?.history ?? [] };
    } else if (local && (local.status === 'dismissed' || local.status === 'completed')) {
      delete next[key];
    }
  }
  return next;
}
