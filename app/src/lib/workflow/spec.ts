/**
 * The Workflow Builder's vocabulary: the ten workflows a school can define, the
 * steps and eligibility checks a definition is built from, and the check that
 * a definition is one the database will store (D-1018).
 *
 * The brief of 30 September (`docs/WORKFLOW-BUILDER.md` carries it) asks for
 * "a visual and API-backed system for approved workflows": trigger, an
 * eligibility check, a plain explanation for the student, a form or action,
 * the student's confirmation, the official handoff, staff review, completion,
 * audit. A definition here is that sequence as data, plus the rules a student
 * must meet — never code, and never a student going through it.
 *
 * ## Held in two places
 *
 * The spec is enforced by the database (`private.workflow_spec()` and
 * `private.workflow_problems()` in `20260930231000_workflow_builder.sql`) and
 * mirrored here, code for code, so the screen can say what is wrong before
 * anyone presses Save. `spec.test.ts` holds this file equal to that one.
 *
 * ## What a rule may read
 *
 * Eight facts, every one a yes/no or a small count: enrolled in a programme,
 * an active term, a prerequisite met, a hold present, an advisor assigned, a
 * deadline open, credits earned, class year. Not a grade, a balance, a
 * diagnosis, a disciplinary record or an immigration detail — the data
 * governance example in the brief names those as prohibited, and the test
 * holds the list to it.
 */

export const WORKFLOWS = [
  'registration_clearance', 'advisor_approval', 'transfer_credit_review', 'study_abroad_approval',
  'tutoring_referral', 'scholarship_deadline', 'org_event_request', 'internship_approval',
  'course_substitution', 'graduation_application',
] as const;
export type WorkflowKey = (typeof WORKFLOWS)[number];

export const WORKFLOW_LABEL: Record<WorkflowKey, string> = {
  registration_clearance: 'Registration clearance checklist',
  advisor_approval: 'Advisor approval request',
  transfer_credit_review: 'Transfer-credit review packet',
  study_abroad_approval: 'Study-abroad course approval',
  tutoring_referral: 'Tutoring referral',
  scholarship_deadline: 'Scholarship deadline',
  org_event_request: 'Student organization event request',
  internship_approval: 'Internship approval',
  course_substitution: 'Course substitution request',
  graduation_application: 'Graduation application preparation',
};

export const STEP_KINDS = ['student_form', 'rule_check', 'staff_review', 'student_confirm', 'official_handoff', 'notify', 'complete'] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const STEP_LABEL: Record<StepKind, string> = {
  student_form: 'The student fills in a form',
  rule_check: 'Check eligibility',
  staff_review: 'Staff review',
  student_confirm: 'The student confirms',
  official_handoff: 'Hand off to the official office',
  notify: 'Notify someone',
  complete: 'Complete',
};

export const OWNERS = ['student', 'advisor', 'registrar', 'office', 'system'] as const;
export type Owner = (typeof OWNERS)[number];
export const OWNER_LABEL: Record<Owner, string> = {
  student: 'The student', advisor: 'The advisor', registrar: 'The registrar', office: 'The office', system: 'Semester',
};

export type FactSpec = { type: 'bool' } | { type: 'int'; min: number; max: number };

export const FACTS = {
  program_enrolled: { type: 'bool' },
  term_active: { type: 'bool' },
  prerequisite_complete: { type: 'bool' },
  hold_present: { type: 'bool' },
  advisor_assigned: { type: 'bool' },
  deadline_open: { type: 'bool' },
  credits_earned: { type: 'int', min: 0, max: 400 },
  class_year: { type: 'int', min: 1, max: 6 },
} as const satisfies Record<string, FactSpec>;
export type FactKey = keyof typeof FACTS;
export const FACT_KEYS = Object.keys(FACTS) as FactKey[];

export const FACT_LABEL: Record<FactKey, string> = {
  program_enrolled: 'Enrolled in a program',
  term_active: 'The term is active',
  prerequisite_complete: 'The prerequisite is complete',
  hold_present: 'A hold is present',
  advisor_assigned: 'An advisor is assigned',
  deadline_open: 'The deadline is open',
  credits_earned: 'Credits earned',
  class_year: 'Class year',
};

export const OPS = { bool: ['eq'], int: ['eq', 'neq', 'gte', 'lte'] } as const;
export type Op = 'eq' | 'neq' | 'gte' | 'lte';
export const OP_LABEL: Record<Op, string> = { eq: 'is', neq: 'is not', gte: 'is at least', lte: 'is at most' };

export const LIMITS = {
  steps_max: 12, requires_max: 10, sla_days_max: 60,
  title_max: 120, explain_max: 300, next_step_max: 200, handoff_max: 200,
} as const;

export interface Step {
  id: string;
  kind: StepKind;
  title: string;
  owner: Owner;
  sla_days?: number;
}
export interface Requirement {
  id: string;
  fact: FactKey;
  op: Op;
  value: boolean | number;
  explain: string;
  next_step: string;
}
export interface Definition {
  title: string;
  steps: Step[];
  requires?: Requirement[];
  handoff?: string;
}

// ── Checking a definition ───────────────────────────────────────────────────

const SLUG = /^[a-z][a-z0-9_]{0,23}$/;
const CARD = /[0-9]([ -]?[0-9]){12,18}/;
// eslint-disable-next-line no-control-regex -- the point is to refuse control characters
const CONTROL = /[\u0000-\u001f\u007f]/;

/** Printable, 1 to `max` characters once trimmed, and no run of 13 to 19 digits. */
export function textOk(t: unknown, max: number): t is string {
  return typeof t === 'string' && t.trim().length >= 1 && t.trim().length <= max && !CONTROL.test(t) && !CARD.test(t);
}

/** The keys a step and a requirement may hold; the database lists the same. */
const STEP_KEYS = ['id', 'kind', 'title', 'owner', 'sla_days'];
const REQ_KEYS = ['id', 'fact', 'op', 'value', 'explain', 'next_step'];

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * What is wrong with a definition, as the database's codes in the database's
 * order: `not_object`, `too_large`, `unknown_key:<k>`, `title`, `steps_count`,
 * `step_shape:<i>`, `step_id:<i>`, `dup_step:<id>`, `step_kind:<id>`,
 * `confirm_before_handoff:<id>`, `step_title:<id>`, `step_owner:<id>`,
 * `step_sla:<id>`, `last_step_complete`, `requires_count`, `req_shape:<i>`,
 * `req_id:<i>`, `dup_req:<id>`, `req_fact:<id>`, `req_op:<id>`,
 * `req_value:<id>`, `req_explain:<id>`, `req_next:<id>`, `handoff`,
 * `handoff_missing`. Empty means the database will store it.
 */
export function problems(d: unknown): string[] {
  if (!isObject(d)) return ['not_object'];
  if (JSON.stringify(d).length > 16384) return ['too_large'];
  const out: string[] = [];

  for (const k of Object.keys(d).sort()) {
    if (!['title', 'steps', 'requires', 'handoff'].includes(k)) out.push(`unknown_key:${k}`);
  }
  if (!textOk(d.title, LIMITS.title_max)) out.push('title');

  let hasConfirm = false;
  let hasHandoff = false;
  let lastKind: unknown;
  let nSteps = 0;
  if (!Array.isArray(d.steps)) {
    out.push('steps_count');
  } else {
    nSteps = d.steps.length;
    if (nSteps < 1 || nSteps > LIMITS.steps_max) out.push('steps_count');
    const seen: string[] = [];
    d.steps.forEach((st, idx) => {
      const i = idx + 1;
      if (!isObject(st)) {
        out.push(`step_shape:${i}`);
        return;
      }
      let sid: string;
      if (typeof st.id !== 'string' || !SLUG.test(st.id)) {
        out.push(`step_id:${i}`);
        sid = `#${i}`;
      } else {
        sid = st.id;
        if (seen.includes(sid)) out.push(`dup_step:${sid}`);
      }
      seen.push(sid);
      if (Object.keys(st).some((k) => !STEP_KEYS.includes(k))) out.push(`step_unknown_key:${sid}`);
      if (typeof st.kind !== 'string' || !(STEP_KINDS as readonly string[]).includes(st.kind)) {
        out.push(`step_kind:${sid}`);
      } else {
        if (st.kind === 'student_confirm') hasConfirm = true;
        if (st.kind === 'official_handoff') {
          hasHandoff = true;
          if (!hasConfirm) out.push(`confirm_before_handoff:${sid}`);
        }
      }
      if (!textOk(st.title, LIMITS.title_max)) out.push(`step_title:${sid}`);
      if (typeof st.owner !== 'string' || !(OWNERS as readonly string[]).includes(st.owner)) out.push(`step_owner:${sid}`);
      if ('sla_days' in st) {
        const v = st.sla_days;
        const ok = typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= LIMITS.sla_days_max;
        if (!ok) out.push(`step_sla:${sid}`);
      }
      lastKind = st.kind;
    });
    if (nSteps >= 1 && lastKind !== 'complete') out.push('last_step_complete');
  }

  if ('requires' in d) {
    if (!Array.isArray(d.requires)) {
      out.push('requires_count');
    } else {
      if (d.requires.length > LIMITS.requires_max) out.push('requires_count');
      const seen: string[] = [];
      d.requires.forEach((rq, idx) => {
        const i = idx + 1;
        if (!isObject(rq)) {
          out.push(`req_shape:${i}`);
          return;
        }
        let sid: string;
        if (typeof rq.id !== 'string' || !SLUG.test(rq.id)) {
          out.push(`req_id:${i}`);
          sid = `#${i}`;
        } else {
          sid = rq.id;
          if (seen.includes(sid)) out.push(`dup_req:${sid}`);
        }
        seen.push(sid);
        if (Object.keys(rq).some((k) => !REQ_KEYS.includes(k))) out.push(`req_unknown_key:${sid}`);
        const fact = typeof rq.fact === 'string' && (FACT_KEYS as string[]).includes(rq.fact) ? FACTS[rq.fact as FactKey] : null;
        if (!fact) {
          out.push(`req_fact:${sid}`);
        } else {
          const ops = OPS[fact.type] as readonly string[];
          if (typeof rq.op !== 'string' || !ops.includes(rq.op)) out.push(`req_op:${sid}`);
          const v = rq.value;
          const ok = fact.type === 'bool'
            ? typeof v === 'boolean'
            : typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 9999 && v >= fact.min && v <= fact.max;
          if (!ok) out.push(`req_value:${sid}`);
        }
        if (!textOk(rq.explain, LIMITS.explain_max)) out.push(`req_explain:${sid}`);
        if (!textOk(rq.next_step, LIMITS.next_step_max)) out.push(`req_next:${sid}`);
      });
    }
  }

  if ('handoff' in d && !textOk(d.handoff, LIMITS.handoff_max)) out.push('handoff');
  if (hasHandoff && !('handoff' in d)) out.push('handoff_missing');
  return out;
}

/** The sentence the screen shows for a code. */
export function problemText(code: string): string {
  const [kind, ref] = code.split(':');
  const at = ref ? ` (${ref})` : '';
  switch (kind) {
    case 'not_object': return 'This is not a workflow definition.';
    case 'too_large': return 'This workflow is too large to store.';
    case 'unknown_key': return `“${ref}” is not something a workflow holds.`;
    case 'title': return 'The workflow needs a title.';
    case 'steps_count': return `A workflow has 1 to ${LIMITS.steps_max} steps.`;
    case 'step_shape': case 'step_id': return `Step ${ref} needs a short id made of lowercase letters, digits and underscores.`;
    case 'step_unknown_key': return `Step “${ref}” holds something a step does not: remove it.`;
    case 'dup_step': return `Two steps share the id “${ref}”.`;
    case 'step_kind': return `Step “${ref}” needs a kind from the list.`;
    case 'step_title': return `Step “${ref}” needs a title.`;
    case 'step_owner': return `Step “${ref}” needs an owner from the list.`;
    case 'step_sla': return `Step “${ref}” can wait 1 to ${LIMITS.sla_days_max} days.`;
    case 'confirm_before_handoff': return `The student confirms before the handoff “${ref}”: add a confirmation step above it.`;
    case 'last_step_complete': return 'The last step must be “Complete”.';
    case 'handoff_missing': return 'A handoff step needs the office it hands off to.';
    case 'handoff': return 'Name the office the workflow hands off to.';
    case 'requires_count': return `A workflow has at most ${LIMITS.requires_max} eligibility checks.`;
    case 'req_shape': case 'req_id': return `Check ${ref} needs a short id made of lowercase letters, digits and underscores.`;
    case 'req_unknown_key': return `Check “${ref}” holds something a check does not: remove it.`;
    case 'dup_req': return `Two checks share the id “${ref}”.`;
    case 'req_fact': return `Check “${ref}” needs a fact from the list.`;
    case 'req_op': return `Check “${ref}” uses a comparison that does not fit its fact.`;
    case 'req_value': return `Check “${ref}” has a value outside what its fact allows.`;
    case 'req_explain': return `Check “${ref}” must explain itself to the student.`;
    case 'req_next': return `Check “${ref}” must say what the student does next.`;
    default: return `${code}${at}`;
  }
}
