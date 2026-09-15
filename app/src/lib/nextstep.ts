/**
 * Which way into a course to offer first.
 *
 * Study showed every way of studying at once — up to eleven chips per course,
 * all the same size, all equally weighted. That is a capable screen and a bad
 * one: it makes somebody decide *how* to study before it has helped them
 * decide *what* to study, and the honest answer to "cards or slides or cram or
 * figures" at 11pm on a Tuesday is that it does not matter nearly as much as
 * starting.
 *
 * So the app answers first and the eleven stay available. One recommendation
 * with a reason, two or three alternatives, and everything else a tap further.
 *
 * ## Recommended, not decided
 *
 * Every rule below reads something the student did — cards falling due, a
 * test approaching, a unit they have not touched — and nothing is hidden by
 * it. The chips are still there under "All ways", in the same order, doing the
 * same thing. This ranks; it does not gate.
 *
 * ## It says why
 *
 * A recommendation with no reason is an instruction, and an instruction from
 * software about how to study is worth roughly nothing. Each one carries the
 * fact it was drawn from — "12 cards are due", "the exam is in 6 days" — so it
 * can be disagreed with.
 */

import { says, type Knowing } from './knowing';
import type { Guide, StudyMode } from './types';

/**
 * A way into the course, as `lib/modes.ts` already models it.
 *
 * The id is the app's own `StudyMode` rather than a loose string, so a typo
 * here cannot become a mode nothing opens.
 */
export interface Way {
  id: StudyMode;
  label: string;
}

export interface StepInput {
  /** Modes that have something in them. From `modesFor(...).filter(ready)`. */
  ways: Way[];
  /** The merged guide, for its units and mastery. */
  guide: Guide;
  /**
   * Where each unit stands, in the same order as `guide.units`.
   *
   * Optional, and only ever used to *say* the reason — never to choose. The
   * choosing below still ranks on `unit.mastery`, which is the blend's proper
   * job: an estimate is a fine tiebreak between units nobody has answered and
   * a poor thing to print as a measurement. This is what gets printed
   * instead. See `lib/knowing.ts`.
   *
   * Absent, the sentence falls back to naming the unit without a claim about
   * it, which is the honest thing to say when the caller has not passed the
   * evidence to make one.
   */
  standings?: Knowing[];
  /**
   * Cards that have genuinely come round. From `comeRound`, not `dueCount`.
   *
   * The difference is the whole reason `lib/review.ts` grew a second counter:
   * the lumped count calls a card nobody has met "due", so a course where one
   * card of a hundred and seven had been answered recommended "Review 101
   * cards" and said they had "come round for review". They had not. Unmet
   * cards fall to the weakest-unit rule below, which is what they are for.
   */
  due: number;
  /**
   * Days until this course's next test, or null if none is known.
   *
   * Was `examIn`, and was fed the *app's* next exam rather than this course's:
   * whichever course held the nearest exam in the whole semester got the
   * countdown and every other course was told it had none. A course examined
   * in eight days looked identical to one examined in April. See `testedIn` in
   * `lib/select.ts`, which answers this per course.
   */
  testIn: number | null;
  /**
   * What that test is — "Exam", "Midterm", "Quiz".
   *
   * Carried so the reason can name it. A quiz called an exam is a small lie
   * that costs the whole line its credibility, and quizzes outnumber exams in
   * most courses by a factor of five.
   */
  testKind: string | null;
  /** True once any card in this course has been answered at all. */
  started: boolean;
}

export interface Step {
  /** The mode to open. Always one of `ways`. */
  id: StudyMode;
  /** The button's words — a verb, not a noun. */
  label: string;
  /** The fact this rests on. Shown under the button. */
  why: string;
}

/** How close an exam has to be before it outranks ordinary revision. */
export const EXAM_SOON = 10;

/**
 * The same, for a quiz.
 *
 * Shorter on purpose. A week and a half out, an exam is worth turning an
 * evening over to and a Thursday quiz is not — cramming for one nine days
 * early costs the evening that ordinary revision would have had, and ordinary
 * revision is what makes the quiz easy anyway.
 */
export const QUIZ_SOON = 4;

/** How near a test has to be to change what tonight is for. */
export function testHorizon(kind: string | null): number {
  return (kind ?? '').toLowerCase() === 'quiz' ? QUIZ_SOON : EXAM_SOON;
}

/** How many alternatives sit beside the recommendation before "All ways". */
export const BESIDE = 3;

const has = (ways: Way[], id: StudyMode) => ways.some((w) => w.id === id);

/**
 * The one thing to offer, and why.
 *
 * Returns null when the course has nothing in it — a course with no cards, no
 * units and no lessons has no next step, and inventing one would be the app
 * talking for the sake of it.
 */
export function nextStep(input: StepInput): Step | null {
  const { ways, guide, due, testIn, testKind, started, standings } = input;
  if (ways.length === 0) return null;

  // Before anything about cards. A card that has never been seen counts as
  // due — correctly, there is no schedule for it yet — so on a course nobody
  // has opened *every* card is due, and without this rule first the app opened
  // a brand new course by announcing "68 cards have come round for review".
  // Nothing had come round. Nothing had gone out.
  //
  // Reading also just comes before being tested on it: a first visit that
  // opens on a flashcard is a course that feels like an exam before it has
  // been a subject.
  if (!started) {
    const first = has(ways, 'read') ? 'read' : has(ways, 'field') ? 'field' : ways[0].id;
    return { id: first, label: 'Start reading', why: 'Nothing answered in this course yet.' };
  }

  // Cards that have come round beat everything else. This is the one rule with a
  // deadline attached — a card reviewed late is a card half forgotten, and the
  // schedule is the student's own answer history rather than the app's idea.
  if (due > 0 && has(ways, 'cards')) {
    return {
      id: 'cards',
      label: `Review ${due} ${due === 1 ? 'card' : 'cards'}`,
      why: `${due === 1 ? 'One card has' : `${due} cards have`} come round for review.`,
    };
  }

  // A test close enough to change what tonight is for.
  if (testIn !== null && testIn >= 0 && testIn <= testHorizon(testKind)) {
    const when = testIn === 0 ? 'today' : testIn === 1 ? 'tomorrow' : `in ${testIn} days`;
    const what = (testKind ?? 'exam').toLowerCase();
    if (has(ways, 'cram')) {
      return { id: 'cram', label: 'Open the cram sheet', why: `The ${what} is ${when}.` };
    }
    if (has(ways, 'quiz')) {
      return { id: 'quiz', label: 'Sit a practice quiz', why: `The ${what} is ${when}.` };
    }
  }

  // The unit that is furthest behind, once there is enough history to say
  // which one that is. `mastery` is per unit and already computed.
  if (has(ways, 'cards') && guide.units.length > 1) {
    let worst = 0;
    guide.units.forEach((u, i) => {
      if (u.mastery < guide.units[worst].mastery) worst = i;
    });
    const unit = guide.units[worst];
    if (unit && unit.mastery < 100) {
      /*
       * Was `${unit.name} is at 30%, the lowest here.`
       *
       * Thirty per cent of what, measured how? `unit.mastery` is
       * `unitMastery`'s blend, and for a unit nobody has answered it is
       * entirely the figure a person wrote into the guide — so a course with
       * one answered card printed a confident two-digit measurement of ten
       * units nothing had measured, under a heading saying what to do about
       * it. The ranking is unchanged and is fine: something has to be picked,
       * and an estimate picks better than nothing. What it cannot do is claim
       * to have counted.
       */
      const state = standings?.[worst];
      return {
        id: 'cards',
        label: 'Drill the weakest unit',
        why: state
          ? `${unit.name} is the least studied here — ${says(state).toLowerCase()}.`
          : `${unit.name} is the least studied here.`,
      };
    }
  }

  // Everything is at full strength and nothing is due. Say so rather than
  // inventing a reason to keep drilling.
  if (has(ways, 'quiz')) {
    return { id: 'quiz', label: 'Test yourself', why: 'Nothing is due. A quiz keeps it honest.' };
  }
  return { id: ways[0].id, label: `Open ${ways[0].label}`, why: '' };
}

/**
 * The two or three offered beside the recommendation.
 *
 * The recommended mode is dropped — offering it twice reads as a mistake — and
 * the rest keep the order `lib/modes.ts` lists them in, which is roughly how
 * often they are used.
 */
export function beside<T extends Way>(ways: T[], step: Step | null, most = BESIDE): T[] {
  return ways.filter((w) => w.id !== step?.id).slice(0, most);
}

/** Whatever is left after the recommendation and its neighbours. */
export function rest<T extends Way>(ways: T[], step: Step | null, most = BESIDE): T[] {
  return ways.filter((w) => w.id !== step?.id).slice(most);
}
