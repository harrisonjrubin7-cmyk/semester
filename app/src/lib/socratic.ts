/**
 * The tutor's rules, as data: what a student is asking for, how much help a
 * course allows, what to do next, and what an answer has to contain.
 *
 * ## Why this exists
 *
 * The assistant has had an integrity picker — Explain, Hint, Practice,
 * Review, Draft — since the intelligence layer landed, and until this module
 * the choice changed nothing the model was told. `converse.ts` recorded the
 * mode on the request and on the response card, and then built the system
 * prompt from `how.mode` alone. A student who pressed Hint on a graded
 * problem set got the same fluent, answer-first paragraph as one who pressed
 * Explain. The button was a label.
 *
 * The blueprint's complaint about conversational tutors is exactly that
 * failure: a helpful conversation feels like learning even when the student
 * never retrieves, applies or remembers anything. The remedy it specifies is
 * not a better tone of voice. It is a ceiling on how much help one reply may
 * give, a decision tree for which help comes next, and a fixed shape for
 * feedback. All three are here, and all three are plain functions so the
 * rules can be tested without a model in the loop.
 *
 * ## The ceiling is the rule the rest turns on
 *
 * Eight levels, from clarifying the goal (0) to the direct answer (7). The
 * mode sets one ceiling and the course sets another, and the lower one wins.
 * Level 7 needs both: a mode that answers, and an assessment that permits
 * it. A graded task whose policy forbids a direct solution never reaches it,
 * whatever the student picks — that is "Guide mode only", and it is the one
 * line `socratic.test.ts` checks from every mode.
 *
 * ## Built without a model
 *
 * `classifyIntent` reads keywords, not meaning, in the same way `lib/mode.ts`
 * does and for the same reason: a rule that needs a model to decide which
 * rule applies cannot be relied on at eleven at night. When it cannot tell,
 * it says `explain`, which is the intent with the least to lose.
 */

import type { IntegrityMode } from '../intelligence/contracts';
import type { CoursePolicy } from './types';

/** The ten things a student comes to a tutor for. */
export type Intent =
  | 'explain'
  | 'work-problem'
  | 'check-reasoning'
  | 'practice'
  | 'office-hours'
  | 'plan-study'
  | 'sources'
  | 'revise-own-work'
  | 'understand-feedback'
  | 'navigate-process';

export const INTENTS: readonly { id: Intent; label: string }[] = [
  { id: 'explain', label: 'Explain a concept' },
  { id: 'work-problem', label: 'Work through a problem' },
  { id: 'check-reasoning', label: 'Check my reasoning' },
  { id: 'practice', label: 'Practice for an assessment' },
  { id: 'office-hours', label: 'Prepare for office hours' },
  { id: 'plan-study', label: 'Plan study time' },
  { id: 'sources', label: 'Find or review sources' },
  { id: 'revise-own-work', label: 'Revise my own work' },
  { id: 'understand-feedback', label: 'Understand feedback' },
  { id: 'navigate-process', label: 'Navigate an academic or campus process' },
];

/*
 * Most specific first. "Check my reasoning on this problem" is a check, not a
 * problem, and "practice questions for the midterm" is practice, not an
 * explanation — so the patterns that name what the student already has
 * (reasoning, feedback, a draft) run before the ones that name a subject.
 */
const SHAPES: readonly [Intent, RegExp][] = [
  ['understand-feedback', /\b(feedback|comments?|rubric|marked|graded|why did i (get|lose)|lost (points|marks))\b/i],
  ['check-reasoning', /\b(check|is this (right|correct)|am i (right|on the right track)|my (reasoning|answer|working|logic|approach))\b/i],
  ['revise-own-work', /\b(revise|improve|edit|proofread|my (draft|essay|paper|thesis|paragraph))\b/i],
  ['office-hours', /\boffice hours?\b|\bwhat (should|do) i ask\b/i],
  ['plan-study', /\b(study plan|plan (my|for|to)|schedule|how (long|much time)|when should i (study|start))\b/i],
  ['practice', /\b(quiz me|practice|test me|flashcards?|review for|prepare for (the |my )?(exam|midterm|final|quiz|test))\b/i],
  ['sources', /\b(sources?|citations?|cite|references?|readings?|articles?|literature)\b/i],
  ['navigate-process', /\b(register|registration|drop|withdraw|add a class|advis(or|ing)|extension|accommodation|petition|financial aid|housing)\b/i],
  ['work-problem', /\b(solve|problem|calculate|compute|derive|prove|find the|how do i (do|answer|approach)|stuck on)\b/i],
];

/** Which of the ten a question is. Falls back to `explain`. */
export function classifyIntent(question: string): Intent {
  for (const [intent, shape] of SHAPES) if (shape.test(question)) return intent;
  return 'explain';
}

/** One step up the help ladder. */
export interface HelpLevel {
  level: HelpLevelId;
  tutor: string;
  student: string;
}

export type HelpLevelId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const HELP_LEVELS: readonly HelpLevel[] = [
  { level: 0, tutor: 'Clarifies the learning goal and constraints', student: 'Knows what is being asked' },
  { level: 1, tutor: 'Asks a guiding question', student: 'Begins their own reasoning' },
  { level: 2, tutor: 'Highlights relevant known information', student: 'Connects concepts' },
  { level: 3, tutor: 'Identifies a principle, formula or source', student: 'Selects an approach' },
  { level: 4, tutor: 'Shows one partial step', student: 'Carries less at once' },
  { level: 5, tutor: 'Shows a comparable worked example', student: 'Learns the pattern without copying' },
  { level: 6, tutor: "Reviews the student's full attempt", student: 'Gets a tailored correction' },
  { level: 7, tutor: 'Gives the direct answer, only where policy permits', student: 'Resolves a low-risk factual need' },
];

/*
 * How far each mode goes on its own.
 *
 * Hint stops at the worked example: reviewing a full attempt is what Review
 * is for, and a hint that grades the whole thing has stopped being a hint.
 * Draft is Review with the student holding the pen — it can critique what
 * they wrote but never writes it for them, so it shares Review's ceiling.
 */
const MODE_CEILING: Record<IntegrityMode, HelpLevelId> = {
  explain: 7,
  hint: 5,
  practice: 6,
  review: 6,
  draft: 6,
};

/** What the course says about the task in front of the student. */
export interface TaskPolicy {
  /** The question is tied to an active graded assessment. */
  graded: boolean;
  /** The assessment's policy permits a direct solution. Ignored when not graded. */
  directAnswerPermitted?: boolean;
}

/**
 * The task policy a course's recorded AI stance implies, for a question about
 * that course's work.
 *
 * Only `allowed` permits a direct solution. Absent and `unstated` are read as
 * no, as they are everywhere else in the app (`Course.ai`): an unread policy
 * is not a permissive one. `graded` is true because a question about course
 * work is the case the policy was written for — the app does not yet know
 * which assessment a question is about, and guessing "not graded" is the
 * guess that lets an answer through.
 */
export function taskPolicyFor(policy: CoursePolicy | undefined): TaskPolicy {
  return { graded: true, directAnswerPermitted: policy?.stance === 'allowed' };
}

export interface Ceiling {
  level: HelpLevelId;
  /** The student-facing reason, when the course rather than the mode set it. */
  reason: string | null;
}

/** The most help one reply may give: the lower of the mode's and the course's. */
export function helpCeiling(mode: IntegrityMode, task: TaskPolicy): Ceiling {
  const byMode = MODE_CEILING[mode];
  if (task.graded && !task.directAnswerPermitted && byMode > 6) {
    return {
      level: 6,
      reason: 'This is tied to a graded assessment that does not permit direct solutions, so the tutor guides rather than answers.',
    };
  }
  return { level: byMode, reason: null };
}

/** Where the student is, as far as the tutor can tell. */
export interface TutorState {
  task: TaskPolicy;
  mode: IntegrityMode;
  /** They are missing the idea the task is built on. */
  needsFoundation?: boolean;
  /** They have shown an attempt of their own. */
  attempted?: boolean;
  /** What diagnosing the attempt found. Only read when `attempted`. */
  misconception?: 'none' | 'prerequisite' | 'other';
  /** The attempt succeeded. Only read when `attempted`. */
  succeeded?: boolean;
  /** Hint rungs already given on this task. */
  hintsUsed?: number;
}

export type Move =
  | 'explain-then-retrieve'
  | 'ask-first-step'
  | 'prerequisite-lesson'
  | 'hint'
  | 'transfer'
  | 'example-or-human';

export interface Next {
  move: Move;
  /** The help level this move sits at, already clamped to the ceiling. */
  level: HelpLevelId;
  ceiling: Ceiling;
  /** What the tutor says it is doing, in the student's terms. */
  says: string;
  /** Always true when the move is the last resort: a person is offered. */
  offerHuman: boolean;
}

function at(level: number, ceiling: Ceiling): HelpLevelId {
  return Math.max(0, Math.min(level, ceiling.level)) as HelpLevelId;
}

/**
 * The blueprint's decision tree, one question at a time, in its order.
 *
 * The graded-assessment check is not a branch here because it is not a
 * choice of move: it is the ceiling, and every move below is clamped to it.
 */
export function nextMove(state: TutorState): Next {
  const ceiling = helpCeiling(state.mode, state.task);
  const make = (move: Move, level: number, says: string, offerHuman = false): Next => ({
    move,
    level: at(level, ceiling),
    ceiling,
    says,
    offerHuman,
  });

  if (state.needsFoundation) {
    return make('explain-then-retrieve', 3, 'A short explanation of the idea underneath, then one question to check it landed.');
  }
  if (!state.attempted) {
    return make('ask-first-step', 0, 'What is the goal, what do you already know, and what would you try first?');
  }
  if (state.succeeded) {
    return make('transfer', 1, 'That works. Here is the same idea in a different setting.');
  }
  if (state.misconception === 'prerequisite') {
    return make('prerequisite-lesson', 3, 'A short lesson on the idea this depends on, then back to your problem.');
  }
  const used = state.hintsUsed ?? 0;
  // The ladder from level 1 up to the worked example; past it, a worked
  // example or a person rather than a sixth hint.
  if (1 + used <= Math.min(5, ceiling.level)) {
    return make('hint', 1 + used, `Hint ${used + 1} of ${Math.min(5, ceiling.level)}.`);
  }
  return make('example-or-human', 5, 'A comparable worked example, a practice variation, or somebody to talk it through with.', true);
}

/**
 * The feedback contract. Every piece of feedback on an attempt has this
 * shape, and `checkFeedback` says which part is missing.
 */
export interface Feedback {
  /** The useful part of what the student did, named specifically. */
  validate: string;
  /** One misconception or missing link — one, not a list. */
  revisit: string;
  /** The one question that moves them forward. */
  ask: string;
  /** One optional layer of support. */
  support?: string;
  /** Where it came from: required whenever a course is in context. */
  source?: string;
  /** What they can do next. One of these is always a person. */
  next: string[];
}

export function checkFeedback(fb: Feedback, courseMode: boolean): string[] {
  const wrong: string[] = [];
  if (!fb.validate.trim()) wrong.push('Validate the useful part of the reasoning first.');
  if (!fb.revisit.trim()) wrong.push('Name one misconception or missing link.');
  const questions = (fb.ask.match(/\?/g) ?? []).length;
  if (questions !== 1) wrong.push('Ask exactly one next question.');
  if (courseMode && !fb.source?.trim()) wrong.push('Show the course source.');
  if (!fb.next.length) wrong.push('Offer a next action.');
  if (!fb.next.some((n) => HUMAN.test(n))) wrong.push('Offer human help as one of the next actions.');
  return wrong;
}

/** The words that mean a person is on the other end. */
const HUMAN = /\b(tutor(ing)?|office hours?|instructor|professor|TA|advis(or|ing)|writing center|librar(y|ian)|human)\b/i;

/**
 * The paragraph the model is given, when a mode asks for tutoring.
 *
 * Explain gets nothing extra: it is the mode that answers. Every other mode
 * gets its ceiling written out as levels, so the model knows what the next
 * rung above it would have been and that it is not to take it.
 */
export function tutorContract(mode: IntegrityMode, task: TaskPolicy): string | null {
  const ceiling = helpCeiling(mode, task);
  if (mode === 'explain' && ceiling.level === 7) return null;
  const allowed = HELP_LEVELS.filter((l) => l.level <= ceiling.level)
    .map((l) => `${l.level}. ${l.tutor}`)
    .join('\n');
  const why = ceiling.reason ? ` ${ceiling.reason}` : '';
  return (
    `The student chose ${mode === 'explain' ? 'Explain' : mode[0].toUpperCase() + mode.slice(1)} mode. You are tutoring, not answering.${why}\n` +
    'Help comes in levels, and one reply may go no higher than the last one listed here:\n' +
    `${allowed}\n` +
    (ceiling.level < 7 ? 'Do not give the final answer or a complete solution, even if asked directly; say that this mode guides and offer the next level instead.\n' : '') +
    'Start at the lowest level that could work. If they have not attempted it, ask for their goal, what they know, or a first step. ' +
    'When they show an attempt, reply in this order: the useful part of their reasoning, named specifically; one misconception or missing link; ' +
    'exactly one question that moves them forward; at most one optional layer of support; the course source if one was used. ' +
    'If they are still stuck after the worked example, offer a practice variation or a person — office hours, a tutor, or the writing center.'
  );
}
