import { forRole, type Role } from './role';
import type { Screen } from './types';

export const RECOVERY_STAGES = ['identify', 'assess', 'offer', 'continue'] as const;
export type RecoveryStage = (typeof RECOVERY_STAGES)[number];
export type RecoveryEvent = 'choose_change' | 'review_impact' | 'choose_option' | 'not_now' | 'restart';

const TRANSITIONS: Record<RecoveryStage, Partial<Record<RecoveryEvent, RecoveryStage>>> = {
  identify: { choose_change: 'assess', not_now: 'identify' },
  assess: { review_impact: 'offer', not_now: 'identify', restart: 'identify' },
  offer: { choose_option: 'continue', not_now: 'identify', restart: 'identify' },
  continue: { restart: 'identify' },
};

export function nextRecoveryStage(stage: RecoveryStage, event: RecoveryEvent): RecoveryStage | null {
  return TRANSITIONS[stage][event] ?? null;
}

export type DisruptionKind =
  | 'deadline_changed'
  | 'schedule_conflict'
  | 'course_changed'
  | 'appointment_cancelled'
  | 'source_unavailable'
  | 'missed_action'
  | 'urgent_overload'
  | 'task_unclear'
  | 'waiting_on'
  | 'time_constrained'
  | 'need_help';

export type RecoveryCategory = 'protect' | 'start' | 'clarify' | 'decide' | 'waiting' | 'ask' | 'reduce';
export type RecoveryIntent = 'short_task';

export interface RecoveryOption {
  label: string;
  screen: Screen;
  reason: string;
  intent?: RecoveryIntent;
}

export interface RecoveryPlan {
  kind: DisruptionKind;
  category: RecoveryCategory;
  title: string;
  affects: string[];
  preserved: string[];
  options: RecoveryOption[];
  confidence: 'confirmed_context' | 'needs_review';
}

export const RECOVERY_PLANS: RecoveryPlan[] = [
  {
    kind: 'deadline_changed',
    category: 'protect',
    title: 'A deadline changed',
    affects: ['The work blocks tied to the old date', 'The shape of this week'],
    preserved: ['The assignment and its source', 'Your other calendar events'],
    options: [
      { label: 'Review the source', screen: 'calendar', reason: 'Confirm the new date before moving work.' },
      { label: 'Re-plan the week', screen: 'calendar', reason: 'Compare open time without changing anything yet.' },
      { label: 'Ask a person', screen: 'help', reason: 'Prepare a question for course staff or support.' },
    ],
    confidence: 'needs_review',
  },
  {
    kind: 'schedule_conflict',
    category: 'decide',
    title: 'A schedule conflict appeared',
    affects: ['The overlapping commitments', 'Travel or preparation time around them'],
    preserved: ['Both original commitments', 'The rest of your plan'],
    options: [
      { label: 'Compare the conflict', screen: 'calendar', reason: 'See the overlap and available alternatives.' },
      { label: 'Adjust availability', screen: 'setWorkload', reason: 'Correct the time Semester may plan into.' },
      { label: 'Ask for help', screen: 'help', reason: 'Find the right person or office.' },
    ],
    confidence: 'confirmed_context',
  },
  {
    kind: 'course_changed',
    category: 'decide',
    title: 'A course or section changed',
    affects: ['The saved schedule', 'Requirements or credit scenarios linked to that course'],
    preserved: ['Your current plan', 'Advisor questions and other selected courses'],
    options: [
      { label: 'Compare course options', screen: 'search', reason: 'Review alternatives without replacing the current plan.' },
      { label: 'Review My Path', screen: 'degree', reason: 'See which entered requirement may be affected.' },
      { label: 'Prepare advisor questions', screen: 'meet', reason: 'Create a student-controlled meeting agenda.' },
    ],
    confidence: 'needs_review',
  },
  {
    kind: 'appointment_cancelled',
    category: 'waiting',
    title: 'An appointment was cancelled',
    affects: ['The questions or decisions waiting for that meeting'],
    preserved: ['Your agenda and notes', 'The rest of your schedule'],
    options: [
      { label: 'Review appointments', screen: 'calendar', reason: 'Find another time without losing the agenda.' },
      { label: 'Open the saved agenda', screen: 'meet', reason: 'Keep preparing while the meeting is rescheduled.' },
      { label: 'Find another support route', screen: 'help', reason: 'Use an appropriate human or official route.' },
    ],
    confidence: 'confirmed_context',
  },
  {
    kind: 'source_unavailable',
    category: 'clarify',
    title: 'A source or connection is unavailable',
    affects: ['Recommendations that depend on current connected data'],
    preserved: ['Student-entered work', 'The last saved plan on this device'],
    options: [
      { label: 'Check connections', screen: 'connect', reason: 'See the last update and reconnect safely.' },
      { label: 'Use the saved plan', screen: 'calendar', reason: 'Continue with clearly labeled local information.' },
      { label: 'Open support', screen: 'help', reason: 'Get a human route if the source stays unavailable.' },
    ],
    confidence: 'needs_review',
  },
  {
    kind: 'missed_action',
    category: 'start',
    title: 'Something did not happen as planned',
    affects: ['The next step and any work that depends on it'],
    preserved: ['Completed work', 'The original due date and source'],
    options: [
      { label: 'Break it into a first step', screen: 'behind', reason: 'Make the remaining work smaller and visible.' },
      { label: 'Review the week', screen: 'calendar', reason: 'Choose a new place deliberately.' },
      { label: 'Ask for help', screen: 'help', reason: 'Prepare a question or find support.' },
    ],
    confidence: 'confirmed_context',
  },
  {
    kind: 'urgent_overload',
    category: 'reduce',
    title: 'I have too many urgent actions',
    affects: ['Which outcome gets protected first', 'How much work is realistic today'],
    preserved: ['Every action and its original source', 'The priorities you have not chosen yet'],
    options: [
      { label: 'Choose one primary outcome', screen: 'behind', reason: 'Keep the other work visible without calling it a failure.' },
      { label: 'Review verified deadlines', screen: 'calendar', reason: 'Protect the nearest source-backed obligation first.' },
      { label: 'Find a human support route', screen: 'help', reason: 'Prepare a question when the tradeoff needs another person.' },
    ],
    confidence: 'confirmed_context',
  },
  {
    kind: 'task_unclear',
    category: 'clarify',
    title: 'I do not understand what is required',
    affects: ['The next step for this work', 'Any plan built from an unclear instruction'],
    preserved: ['The original prompt, rubric, and source', 'Your notes and current plan'],
    options: [
      { label: 'Open Study and choose the course', screen: 'study', reason: 'Go to Study, then select the relevant course materials and saved notes.' },
      { label: 'Open support options', screen: 'help', reason: 'Review human support routes and decide whom to contact.' },
      { label: 'Keep this for later', screen: 'calendar', reason: 'Leave the work visible without inventing an answer.' },
    ],
    confidence: 'needs_review',
  },
  {
    kind: 'waiting_on',
    category: 'waiting',
    title: 'I am waiting on someone or a system',
    affects: ['The next action that depends on a response', 'The date you should follow up'],
    preserved: ['Your original request and selected context', 'Work you can continue independently'],
    options: [
      { label: 'Set a follow-up date', screen: 'calendar', reason: 'Keep the owner and next check visible.' },
      { label: 'Open support options', screen: 'help', reason: 'Review human support routes and decide how you want to follow up; nothing is sent automatically.' },
      { label: 'Work on something independent', screen: 'home', reason: 'Return to an action that is not blocked by the response.' },
    ],
    confidence: 'confirmed_context',
  },
  {
    kind: 'time_constrained',
    category: 'start',
    title: 'I only have a few minutes',
    affects: ['The size of the next step, not the importance of the work'],
    preserved: ['The full action and verified deadline', 'The option to return to the original plan'],
    options: [
      { label: 'Start a 2–25 minute version', screen: 'behind', intent: 'short_task', reason: 'Choose a small executable step without shrinking the official requirement.' },
      { label: 'Move one work block', screen: 'calendar', reason: 'Choose a later window deliberately.' },
      { label: 'Ask what minimum progress helps', screen: 'help', reason: 'Use a human route when the deadline or requirement cannot move.' },
    ],
    confidence: 'confirmed_context',
  },
  {
    kind: 'need_help',
    category: 'ask',
    title: 'I need help from a person',
    affects: ['Which context you choose to share', 'Who owns the next step'],
    preserved: ['Everything you do not select', 'Your private plan, notes, and reflections'],
    options: [
      { label: 'Find the right person or office', screen: 'help', reason: 'Review the route and choose what to include.' },
      { label: 'Prepare an advisor agenda', screen: 'meet', reason: 'Keep the questions under your control.' },
      { label: 'Return to my plan', screen: 'home', reason: 'Nothing is shared merely because you opened Recovery Mode.' },
    ],
    confidence: 'confirmed_context',
  },
];

export function recoveryPlan(kind: DisruptionKind, role?: Role): RecoveryPlan {
  const plan = RECOVERY_PLANS.find((candidate) => candidate.kind === kind)!;
  if (!role) return plan;
  return { ...plan, options: plan.options.filter((option) => forRole(option.screen, role)) };
}
