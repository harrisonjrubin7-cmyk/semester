/**
 * The Learning Map and its Start Here Check.
 *
 * `lib/learning-loop.ts` already reads a course's units and the answers given
 * to their cards into a state per concept. This is the student's side of it:
 * the words for those states, a short low-stakes check to begin with, and the
 * student's own additions.
 *
 * ## What it will not say
 *
 * A state is where the evidence stands, never who the student is. The labels
 * are the ones the student would use about themselves ("Exploring", "Review
 * later"), and nothing here says weak, at risk, or likely to fail. "Not sure"
 * is always a valid answer to a check question and is never scored as a
 * failure of the student — it is recorded as "not yet", and the result says so.
 *
 * The check produces practice suggestions. It produces no grade, rank or
 * record, and whether its result may shape the study plan is the student's
 * choice each time.
 */

import { learningState, type ConceptLearningState, type ConceptState, type LearningConcept, type LearningLoopInput } from './learning-loop';
import { cardIdentity, type Reviews } from './review';
import { obj, textValue } from './device-library';
import type { Guide, StudyCard } from './types';

/** What a student may call their own standing on something they added. */
export const OWN_LABELS = [
  'Not started',
  'Exploring',
  'Practicing',
  'Can explain with notes',
  'Can apply independently',
  'Review later',
] as const;
export type OwnLabel = (typeof OWN_LABELS)[number];

/**
 * The student-facing word for a measured state.
 *
 * `retained` is "Can explain with notes" and not "Can apply independently":
 * card answers are recall, and recall is not application. Only the student can
 * say the second, on their own concepts.
 */
export const STATE_WORDS: Record<ConceptLearningState, OwnLabel> = {
  unseen: 'Not started',
  introduced: 'Exploring',
  practising: 'Practicing',
  retained: 'Can explain with notes',
  'needs-review': 'Review later',
};

export interface OwnConcept {
  id: string;
  courseId: string;
  name: string;
  note: string;
  label: OwnLabel;
  /** The student asked for help understanding this. Private until they share it. */
  question: boolean;
}

/** One line on what to do next, with its reason. Never a prediction. */
export function nextAction(concept: Pick<ConceptState, 'state' | 'name'>, dueOnConcept = false): { text: string; why: string } {
  switch (concept.state) {
    case 'unseen':
      return { text: `Try the Start Here Check or read ${concept.name}`, why: 'Nothing has been answered on it yet, so nothing is measured.' };
    case 'introduced':
      return { text: `Answer a few cards on ${concept.name}`, why: 'A first look has been recorded; practice is what moves it.' };
    case 'practising':
      return { text: dueOnConcept ? `Review ${concept.name} — cards are due` : `Keep practicing ${concept.name}`, why: 'You have answered some cards on it.' };
    case 'retained':
      return { text: `Explain ${concept.name} from memory, then check the source`, why: 'Recall is going well; explaining it is the next step up.' };
    case 'needs-review':
      return { text: `Review ${concept.name}`, why: 'A recent answer was missed or cards on it are due.' };
  }
}

// ── The Start Here Check ───────────────────────────────────────────────

export type Answer = 'got' | 'unsure' | 'missed';

export interface CheckQuestion {
  conceptId: string;
  unit: number;
  card: StudyCard;
}

export const CHECK_LENGTHS = [5, 8, 10] as const;

/**
 * Questions for the check, drawn from every unit in turn so the check samples
 * the whole course rather than the first chapter. Only the course's own cards —
 * nothing is generated. Fewer than asked for when the course has fewer.
 */
export function pickCheck(courseId: string, guide: Guide, length: number): CheckQuestion[] {
  const queues = guide.units.map((u, unit) => ({ unit, cards: [...u.cards] }));
  const out: CheckQuestion[] = [];
  const want = Math.max(1, Math.min(length, 20));
  while (out.length < want && queues.some((q) => q.cards.length > 0)) {
    for (const q of queues) {
      const card = q.cards.shift();
      if (card && out.length < want) out.push({ conceptId: `${courseId}:unit:${q.unit}`, unit: q.unit, card });
    }
  }
  return out;
}

export interface CheckAnswer {
  conceptId: string;
  answer: Answer;
}

export interface CheckResult {
  answered: number;
  got: number;
  unsure: number;
  missed: number;
  /** Concepts worth another look, in course order, with why. */
  revisit: { conceptId: string; name: string; why: string }[];
  /** What was handled well — said first, because the check is not only a list of gaps. */
  handled: string[];
}

export function checkResult(concepts: LearningConcept[], answers: CheckAnswer[]): CheckResult {
  const count = (a: Answer) => answers.filter((x) => x.answer === a).length;
  const revisit: CheckResult['revisit'] = [];
  const handled: string[] = [];
  for (const c of concepts) {
    const mine = answers.filter((a) => a.conceptId === c.id);
    if (mine.length === 0) continue;
    const missed = mine.filter((a) => a.answer === 'missed').length;
    const unsure = mine.filter((a) => a.answer === 'unsure').length;
    if (missed > 0) revisit.push({ conceptId: c.id, name: c.name, why: 'You marked a question on it as missed.' });
    else if (unsure > 0) revisit.push({ conceptId: c.id, name: c.name, why: 'You were not sure on a question about it.' });
    else handled.push(c.name);
  }
  return { answered: answers.length, got: count('got'), unsure: count('unsure'), missed: count('missed'), revisit, handled };
}

/** The sentences under a result. It suggests; it never scores the person. */
export function checkWords(r: CheckResult): string[] {
  if (r.answered === 0) return ['Nothing answered yet.'];
  const lines: string[] = [];
  if (r.handled.length > 0) lines.push(`You handled these well: ${r.handled.join(', ')}.`);
  if (r.revisit.length > 0) lines.push(`Worth another look: ${r.revisit.map((x) => x.name).join(', ')}.`);
  else lines.push('Nothing here needs another look right now.');
  lines.push('This is a starting point for practice, not a grade, and it is not kept as a record of you.');
  return lines;
}

/** The private, per-device state the panel keeps. */
export interface MapStore {
  version: 1;
  own: OwnConcept[];
  /** The latest check per course, and whether the student let it shape their plan. */
  checks: Record<string, { at: string; answers: CheckAnswer[]; useInPlan: boolean }>;
}

export const EMPTY_MAP: MapStore = { version: 1, own: [], checks: {} };

export const MAP_PREFIX = 'semester.learning-map.v1';

const ANSWERS: readonly Answer[] = ['got', 'unsure', 'missed'];

/** Rebuilt field by field: an unknown label or answer is refused, never trusted. */
export function readMap(v: unknown): MapStore {
  if (!obj(v) || v.version !== 1 || !Array.isArray(v.own) || v.own.length > 300 || !obj(v.checks)) throw new Error('Invalid learning map.');
  if (
    v.own.some(
      (o) =>
        !obj(o) ||
        !['id', 'courseId', 'name'].every((k) => textValue(o[k], 500)) ||
        !textValue(o.note, 4000) ||
        !(OWN_LABELS as readonly unknown[]).includes(o.label) ||
        typeof o.question !== 'boolean',
    )
  )
    throw new Error('Invalid learning map.');
  for (const c of Object.values(v.checks))
    if (
      !obj(c) ||
      !textValue(c.at, 40) ||
      typeof c.useInPlan !== 'boolean' ||
      !Array.isArray(c.answers) ||
      c.answers.length > 50 ||
      c.answers.some((a) => !obj(a) || !textValue(a.conceptId, 500) || !(ANSWERS as readonly unknown[]).includes(a.answer))
    )
      throw new Error('Invalid learning map.');
  return v as unknown as MapStore;
}

/**
 * Overdue cards per concept.
 *
 * `learningState` reads one `due` number for the whole input and marks every
 * concept that has any attempt as "review later" when it is above zero — so one
 * overdue card in one unit would label every unrelated unit the student had
 * answered. The count is per unit here, and `statesByConcept` reads each
 * concept against its own.
 */
export function dueByConcept(courseId: string, guide: Guide, reviews: Reviews, now: number): Record<string, number> {
  const out: Record<string, number> = {};
  guide.units.forEach((u, i) => {
    out[`${courseId}:unit:${i}`] = u.cards.filter((c) => {
      const r = reviews[cardIdentity(courseId, c)];
      return !!r && r.due <= now;
    }).length;
  });
  return out;
}

/** Each concept's state, read against the overdue cards of that concept alone. */
export function statesByConcept(input: LearningLoopInput, due: Record<string, number>): ConceptState[] {
  return input.concepts.flatMap((c) => learningState({ ...input, concepts: [c], due: due[c.id] ?? 0 }));
}
