import type { IntegrityMode } from '../intelligence/contracts';
import { fromCourse, permits, redirect, resolve, type Use } from './toolkit/policy';
import type { CoursePolicy } from './types';

/**
 * How the assistant tutors, when the student has asked it to.
 *
 * The Ask screen already had a mode picker — Explain, Hint, Practice, Review,
 * Draft — and the mode travelled in the request envelope and to the
 * institution gateway. On the local path it went nowhere. `systemPrompt` was
 * built from the question type alone, so a student who pressed Hint got the
 * same full worked answer as one who pressed Explain. The button was a label.
 *
 * This is what the button now means. It is prompt text, not a model call, and
 * it is pure, so `socratic.test.ts` can check exactly what each mode tells the
 * model to do and not do.
 *
 * ## Three things it is built from
 *
 * - **A hint ladder of eight rungs** (`RUNGS`). Rung 0 clarifies the goal and
 *   rung 7 is the direct answer. The tutor climbs one rung per request, from
 *   the lowest one that is useful, and each rung has to leave work for the
 *   student — the same rule `lib/ladder.ts` holds for the practice quiz.
 * - **A decision order** (`STEPS`): policy first, then whether the student
 *   needs the idea before the problem, then whether they have tried, then
 *   whether a wrong turn is a missing prerequisite. Retrieval and transfer
 *   come after success, because a helpful conversation that never asks the
 *   student to produce anything feels like learning and often is not.
 * - **A feedback contract** (`FEEDBACK`): name what is right, name one thing
 *   that is wrong, ask one question, say where it came from. One, not five —
 *   a list of every flaw is a rewrite with extra steps.
 *
 * ## The top rung belongs to the policy, not the student
 *
 * `ceiling` is the highest rung the tutor may reach, and it is 7 only when
 * nothing says otherwise *and* no course is in view. Any course in view caps
 * it at 6, whatever its recorded stance: `fromCourse` already reads even a
 * blanket "AI is allowed" as not permitting final answers for an assessment,
 * and an unrecorded policy is not a permissive one (`lib/toolkit/policy.ts`
 * says so at length). Rung 6 — review the student's own full attempt — is as
 * far as it goes.
 *
 * ## Explain is left alone
 *
 * Explain is the default, and it is what every question got before this
 * existed. Giving it a tutoring fragment would turn "explain elasticity" into
 * a quiz, which is the narrowing `ai/prompt.ts` records as a real failure. So
 * `tutoring('explain', …)` is empty, and a student who never touches the
 * picker gets the assistant they had.
 *
 * ## What it will not do
 *
 * It does not grade, keep score, or count streaks. A tutor that rewards the
 * student for coming back is optimising the wrong thing; one that helps them
 * leave able to do it alone is the point. And when the ladder runs out it
 * names a person — office hours, a tutor, the writing centre, the library —
 * rather than rung eight.
 */

export type Rung = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface RungSpec {
  rung: Rung;
  /** What the tutor does on this rung, as an instruction. */
  move: string;
}

export const RUNGS: readonly RungSpec[] = [
  { rung: 0, move: 'Clarify the goal: what the question asks for and what counts as done.' },
  { rung: 1, move: 'Ask one guiding question that starts their own reasoning.' },
  { rung: 2, move: 'Point at the information they already have that matters.' },
  { rung: 3, move: 'Name the principle, formula or course source that applies — not how to use it.' },
  { rung: 4, move: 'Show one partial step, and leave the rest to them.' },
  { rung: 5, move: 'Work a comparable example with different numbers or a different case.' },
  { rung: 6, move: 'Review their full attempt: what holds, and the first place it goes wrong.' },
  { rung: 7, move: 'Give the direct answer.' },
];

/** The rung that is the answer itself. */
export const DIRECT: Rung = 7;

/** The order the tutor decides in, top to bottom. */
export const STEPS: readonly string[] = [
  'If this is part of graded work, stay below the ceiling given here whatever they ask.',
  'If they are missing the idea itself, explain it in a few sentences, then ask them to put it back in their own words.',
  'If they have not tried yet, ask for their goal, what they know, or their first step. Do not start solving.',
  'If they have tried, find the useful part of their reasoning and the first misconception.',
  'If the misconception is a missing prerequisite, teach that briefly, then return to the original problem.',
  'Otherwise, climb the hint ladder one rung.',
  'When they get it, give them a varied problem that applies the same idea somewhere new.',
  'If they are still stuck after a comparable example, stop adding hints and name a person who can help.',
];

/** What every response to a student attempt contains, in this order. */
export const FEEDBACK =
  'When you respond to their attempt: say in one sentence what part of their reasoning is right; ' +
  'name one misconception or missing link, not every flaw; ask one next question; and say which ' +
  'course source or rule it rests on, or that it rests on general knowledge.';

/*
 * The people, and how to reach them from here.
 *
 * Office hours live on each course (`screens/Courses.tsx` mounts
 * `OfficeHours`), and `courses` is a screen `open_screen` can reach. Tutoring,
 * the writing centre and the library are behind Get help on the University
 * screen, which the tool cannot open, so the model is told to name it instead.
 * `drill` is where a prerequisite gets practised.
 */
export const HANDOFF =
  'People who can help, and where they are: office hours for this course (open_screen "courses"); ' +
  'tutoring, the writing centre and the library (Get help, on the University screen — name it, ' +
  'you cannot open it); practice on a prerequisite (open_screen "drill").';

/** Which policy use each mode needs. Hint is guided explanation. */
const NEEDS: Record<IntegrityMode, Use> = {
  explain: 'explanation',
  hint: 'explanation',
  practice: 'practice',
  review: 'outline-feedback',
  draft: 'revision',
};

export const MODES: readonly IntegrityMode[] = ['explain', 'hint', 'practice', 'review', 'draft'];

export interface TutorPolicy {
  /** The modes the picker offers. Empty when the course bans AI. */
  allowed: IntegrityMode[];
  /** The highest rung the tutor may reach. */
  ceiling: Rung;
  /** One line under the picker saying where the limits came from. */
  reason: string;
  /** Alternatives to offer when help is refused, already filtered by policy. */
  instead: string[];
  code?: string;
}

/**
 * The limits for the course in view.
 *
 * A course with no recorded stance keeps every mode — refusing all help until
 * somebody reads their syllabus would make Ask useless on day one — but never
 * reaches the direct answer, because unknown policy never permits that. A
 * recorded stance decides each mode through `lib/toolkit/policy.ts`, the same
 * resolver the toolkit panels use, so the two can never disagree.
 */
export function tutorPolicy(course?: { code: string; ai?: CoursePolicy }): TutorPolicy {
  if (!course) {
    return { allowed: [...MODES], ceiling: DIRECT, reason: '', instead: [] };
  }
  const layer = fromCourse(course.ai);
  const layers = [layer];
  const instead = redirect(layers).map((r) => r.label);
  if (!layer) {
    return {
      allowed: [...MODES],
      ceiling: 6,
      reason: `No AI policy is recorded for ${course.code}, so hints stop short of the answer.`,
      instead,
      code: course.code,
    };
  }
  const allowed = MODES.filter((m) => permits(resolve(NEEDS[m], layers).state));
  const direct = permits(resolve('final-answers', layers).state);
  return {
    allowed,
    ceiling: direct ? DIRECT : 6,
    reason: allowed.length
      ? `From the AI policy you recorded for ${course.code}.`
      : `The AI policy you recorded for ${course.code} does not allow AI help with its work.`,
    instead,
    code: course.code,
  };
}

function ladder(ceiling: Rung): string {
  return RUNGS.filter((r) => r.rung <= ceiling)
    .map((r) => `${r.rung}. ${r.move}`)
    .join('\n');
}

function steps(): string {
  return STEPS.map((s, i) => `${i + 1}. ${s}`).join('\n');
}

function capLine(policy: TutorPolicy): string {
  return policy.ceiling < DIRECT
    ? `Ceiling: rung ${policy.ceiling}. Do not give the final answer to ${policy.code ?? 'their'} ` +
        'coursework, even if asked directly or asked again. Say once, plainly, that the course ' +
        'policy does not allow it, and keep helping at the rungs below.'
    : 'Ceiling: rung 7, but only when the question is not graded work and they have asked for it.';
}

/**
 * The tutoring paragraph for the system prompt, or '' when there is none.
 *
 * `mode` is the mode the picker settled on. A mode the policy does not allow
 * is treated as no mode at all: the fragment says what the course allows
 * instead, rather than quietly tutoring in a mode the student cannot select.
 */
export function tutoring(mode: IntegrityMode | null, policy: TutorPolicy): string {
  if (mode === null || !policy.allowed.includes(mode)) {
    if (!policy.code || policy.allowed.length) return '';
    const alternatives = policy.instead.length
      ? ` What you can offer instead: ${policy.instead.join('; ')}.`
      : '';
    return (
      `The student recorded that ${policy.code} does not allow AI help with its work. If this ` +
      `question is about that course's assessed work, say so in one sentence and do not do the ` +
      `work.${alternatives} Questions that are not about that course are unaffected.`
    );
  }
  if (mode === 'explain') return '';
  if (mode === 'hint') {
    return (
      'The student chose Hint: tutor, do not solve. Decide in this order:\n' +
      `${steps()}\n\n` +
      'The hint ladder. Give one rung per reply, starting from the lowest rung that is useful, and ' +
      'go up only when they ask again or their attempt shows they need it. Each rung must leave ' +
      `them something to do.\n${ladder(policy.ceiling)}\n${capLine(policy)}\n\n` +
      `${FEEDBACK}\n\n${HANDOFF}`
    );
  }
  if (mode === 'practice') {
    return (
      'The student chose Practice. Set one question at a time on the concept, never the assessed ' +
      'problem itself, and wait for their answer before saying anything about it. Move from ' +
      'recall, to explaining why, to applying it to a case they have not seen. If they miss the ' +
      `same idea twice, go back to its prerequisite.\n\n${FEEDBACK}\n${capLine(policy)}\n\n${HANDOFF}`
    );
  }
  if (mode === 'review') {
    return (
      'The student chose Review: they want their own reasoning or work checked. If they have not ' +
      `shared an attempt, ask for it and nothing else. Do not rewrite it for them.\n\n${FEEDBACK}\n` +
      `${capLine(policy)}\n\n${HANDOFF}`
    );
  }
  return (
    'The student chose Draft. Help them plan, outline and revise writing that is theirs: suggest, ' +
    'question and point to the rubric, and keep their words as theirs. Do not write a submission ' +
    `for them.\n${capLine(policy)}` +
    (policy.code && policy.ceiling < DIRECT
      ? ' If the course asks for AI use to be disclosed, remind them once to say how they used it.'
      : '')
  );
}
