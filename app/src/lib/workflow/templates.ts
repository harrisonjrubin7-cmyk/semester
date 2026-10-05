/**
 * The ten starting points, one for each workflow the brief lists (D-1018).
 *
 * A school starts from one and changes it; none is applied on its own, and
 * none is a claim about what any school's process is. Each is valid — the test
 * runs every one through `problems` — and follows the brief's sequence:
 * check eligibility, explain the blocker, take the form, have the student
 * confirm, hand off to the official office, review by staff where the
 * process has one, complete.
 */
import type { Definition, Owner, Requirement, Step, StepKind, WorkflowKey } from './spec';

const step = (id: string, kind: StepKind, title: string, owner: Owner, sla_days?: number): Step =>
  sla_days === undefined ? { id, kind, title, owner } : { id, kind, title, owner, sla_days };

const need = (id: string, fact: Requirement['fact'], op: Requirement['op'], value: boolean | number, explain: string, next_step: string): Requirement =>
  ({ id, fact, op, value, explain, next_step });

const ENROLLED = need('enrolled', 'program_enrolled', 'eq', true, 'You need to be enrolled in a program to use this.', 'Ask the registrar to confirm your enrollment.');
const ACTIVE = need('term_active', 'term_active', 'eq', true, 'This is only open during an active term.', 'Check the academic calendar for the next term.');
const NO_HOLD = need('no_hold', 'hold_present', 'eq', false, 'A hold on your record needs clearing first.', 'Contact the office that placed the hold; the registrar can tell you which.');
const ADVISOR = need('advisor', 'advisor_assigned', 'eq', true, 'You need an advisor assigned to review this.', 'Ask your department to assign an advisor.');
const OPEN = need('open', 'deadline_open', 'eq', true, 'The deadline for this has passed or has not opened.', 'Check the office’s page for the next window.');

export const TEMPLATES: Record<WorkflowKey, Definition> = {
  registration_clearance: {
    title: 'Registration clearance checklist',
    steps: [
      step('check', 'rule_check', 'Check what registration needs', 'system'),
      step('review', 'staff_review', 'Registrar reviews anything unclear', 'registrar', 5),
      step('confirm', 'student_confirm', 'Confirm you are ready to register', 'student'),
      step('handoff', 'official_handoff', 'Register in the official system', 'office'),
      step('done', 'complete', 'Done', 'system'),
    ],
    requires: [ENROLLED, ACTIVE, NO_HOLD],
    handoff: 'Office of the Registrar',
  },
  advisor_approval: {
    title: 'Advisor approval request',
    steps: [
      step('check', 'rule_check', 'Check you can ask', 'system'),
      step('form', 'student_form', 'Say what you are asking approval for', 'student'),
      step('review', 'staff_review', 'Your advisor reviews it', 'advisor', 5),
      step('confirm', 'student_confirm', 'Confirm the decision', 'student'),
      step('done', 'complete', 'Done', 'system'),
    ],
    requires: [ENROLLED, ADVISOR],
  },
  transfer_credit_review: {
    title: 'Transfer-credit review packet',
    steps: [
      step('check', 'rule_check', 'Check you can submit a packet', 'system'),
      step('form', 'student_form', 'List the courses and attach the syllabi', 'student'),
      step('review', 'staff_review', 'The registrar reviews the packet', 'registrar', 20),
      step('confirm', 'student_confirm', 'Confirm the credit you are asking for', 'student'),
      step('handoff', 'official_handoff', 'Record the credit in the official system', 'office'),
      step('done', 'complete', 'Done', 'system'),
    ],
    requires: [ENROLLED, NO_HOLD],
    handoff: 'Office of the Registrar',
  },
  study_abroad_approval: {
    title: 'Study-abroad course approval',
    steps: [
      step('check', 'rule_check', 'Check you can apply', 'system'),
      step('form', 'student_form', 'List the courses you plan to take abroad', 'student'),
      step('review', 'staff_review', 'Advisor and department review', 'advisor', 15),
      step('confirm', 'student_confirm', 'Confirm your plan', 'student'),
      step('handoff', 'official_handoff', 'Send to the study-abroad office', 'office'),
      step('done', 'complete', 'Done', 'system'),
    ],
    requires: [
      ENROLLED,
      need('credits', 'credits_earned', 'gte', 30, 'This asks for at least 30 credits earned.', 'See your advisor about a plan to get there.'),
      NO_HOLD,
    ],
    handoff: 'Study-abroad office',
  },
  tutoring_referral: {
    title: 'Tutoring referral',
    steps: [
      step('check', 'rule_check', 'Check tutoring is open to you', 'system'),
      step('form', 'student_form', 'Say which course you want help with', 'student'),
      step('confirm', 'student_confirm', 'Confirm you want the referral sent', 'student'),
      step('handoff', 'official_handoff', 'Send to the tutoring center', 'office'),
      step('done', 'complete', 'Done', 'system'),
    ],
    requires: [ENROLLED, ACTIVE],
    handoff: 'Tutoring center',
  },
  scholarship_deadline: {
    title: 'Scholarship deadline',
    steps: [
      step('check', 'rule_check', 'Check the deadline is open', 'system'),
      step('notify', 'notify', 'Remind you before it closes', 'system'),
      step('confirm', 'student_confirm', 'Confirm you have applied', 'student'),
      step('done', 'complete', 'Done', 'system'),
    ],
    requires: [ENROLLED, OPEN],
  },
  org_event_request: {
    title: 'Student organization event request',
    steps: [
      step('check', 'rule_check', 'Check the organization can request an event', 'system'),
      step('form', 'student_form', 'Describe the event', 'student'),
      step('review', 'staff_review', 'Student life reviews the request', 'office', 7),
      step('confirm', 'student_confirm', 'Confirm the details', 'student'),
      step('handoff', 'official_handoff', 'Book the space with student life', 'office'),
      step('done', 'complete', 'Done', 'system'),
    ],
    requires: [ENROLLED, ACTIVE],
    handoff: 'Office of Student Life',
  },
  internship_approval: {
    title: 'Internship approval',
    steps: [
      step('check', 'rule_check', 'Check you can ask for approval', 'system'),
      step('form', 'student_form', 'Describe the placement', 'student'),
      step('review', 'staff_review', 'Career services and your advisor review it', 'advisor', 10),
      step('confirm', 'student_confirm', 'Confirm the placement', 'student'),
      step('handoff', 'official_handoff', 'Record it with career services', 'office'),
      step('done', 'complete', 'Done', 'system'),
    ],
    requires: [ENROLLED, ACTIVE, ADVISOR],
    handoff: 'Career services',
  },
  course_substitution: {
    title: 'Course substitution request',
    steps: [
      step('check', 'rule_check', 'Check you can ask for a substitution', 'system'),
      step('form', 'student_form', 'Say which course and why', 'student'),
      step('review', 'staff_review', 'Your advisor and the department review it', 'advisor', 10),
      step('confirm', 'student_confirm', 'Confirm the substitution', 'student'),
      step('handoff', 'official_handoff', 'Update the degree audit in the official system', 'office'),
      step('done', 'complete', 'Done', 'system'),
    ],
    requires: [ENROLLED, ADVISOR, NO_HOLD],
    handoff: 'Office of the Registrar',
  },
  graduation_application: {
    title: 'Graduation application preparation',
    steps: [
      step('check', 'rule_check', 'Check you can apply to graduate', 'system'),
      step('form', 'student_form', 'Confirm your name and diploma details', 'student'),
      step('review', 'staff_review', 'The registrar checks your degree', 'registrar', 15),
      step('confirm', 'student_confirm', 'Confirm your application', 'student'),
      step('handoff', 'official_handoff', 'File it in the official system', 'office'),
      step('done', 'complete', 'Done', 'system'),
    ],
    requires: [
      ENROLLED,
      need('credits', 'credits_earned', 'gte', 90, 'Applying usually needs 90 credits earned; your school may set a different number.', 'See your advisor for a degree check.'),
      NO_HOLD,
      OPEN,
    ],
    handoff: 'Office of the Registrar',
  },
};
