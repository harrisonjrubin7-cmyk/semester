/**
 * The eleven ways through a course, described.
 *
 * They used to be ten one-word chips in a row that scrolled sideways. On a
 * phone about four were visible, so six ways of studying existed and were
 * invisible unless you happened to drag the row — and the four you could see
 * said "Doc", "Cram", "Cases" without saying what those are. Worse, a mode
 * with nothing behind it looked identical to one with forty-four narrated
 * lessons behind it, so the only way to find out was to tap and be told no.
 *
 * So each mode now carries a sentence saying what it is for and a count of
 * what is actually there for this course. A mode with nothing says so before
 * you spend a tap on it, and says what would fill it.
 */

import type { Catalog } from '../data/catalog';
import { allCards } from '../data/catalog';
import { distinctAnswers } from './quiz';
import { canSpeak } from './speak';
import type { CourseId, Guide, StudyMode, Example } from './types';

export interface ModeInfo {
  id: StudyMode;
  label: string;
  /** What this mode is, in the second person, short enough for a card. */
  blurb: string;
  /** "44 lessons", "12 figures" — what is actually there. */
  count: string;
  /** False when the mode would open on an empty state. */
  ready: boolean;
  /** Said in place of the count when nothing is there. */
  missing?: string;
}

interface Source {
  /*
   * Deliberately the plain `Guide` and a separate `examples`, not `LiveGuide`.
   * Widening this would force every fixture that calls `modesFor` to build a
   * whole merged guide to count a mode, which is a lot of ceremony to ask of a
   * test about whether the Watch tab is empty.
   */
  guide: Guide;
  /** The module's worked examples with any added ones already folded in. */
  examples?: Example[];
  lessons: Record<number, unknown>;
  figures: Record<number, unknown>;
  extras: unknown[];
  /**
   * Whether this device will read a lesson out loud.
   *
   * Overridable for a test, and answered from the browser when nobody says —
   * `lib/speak.ts` explains when it can be no: a browser without
   * `speechSynthesis`, or one that has it and refuses.
   *
   * Asked here rather than required of the caller, and that is the whole
   * point. There are four places that build one of these, and a fifth will
   * arrive; a field every one of them has to remember is how a mode comes to
   * promise narration on a device that cannot give it, which is the failure
   * at the top of this file. A default of `true` would do the same thing
   * more quietly.
   */
  canSpeak?: boolean;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The Watch card, which has three states rather than two. */
function watch(lessons: number, units: number, canSpeak: boolean): ModeInfo {
  if (lessons > 0) {
    return {
      id: 'watch',
      label: 'Watch',
      blurb: 'A narrated lesson per unit, the slide changing as the voice moves.',
      count: plural(lessons, 'lesson'),
      ready: true,
    };
  }
  if (units > 0 && canSpeak) {
    return {
      id: 'watch',
      label: 'Watch',
      blurb: 'This unit read aloud by your device, one question at a time — not a recording.',
      count: `${plural(units, 'unit')}, read here`,
      ready: true,
    };
  }
  return {
    id: 'watch',
    label: 'Watch',
    blurb: 'A narrated lesson per unit, the slide changing as the voice moves.',
    count: plural(0, 'lesson'),
    ready: false,
    missing:
      units > 0
        ? 'Nothing is recorded for this course, and this browser will not read aloud.'
        : 'No lessons rendered for this course.',
  };
}

export function modesFor(cat: Catalog, courseId: CourseId, src: Source): ModeInfo[] {
  const { guide, lessons, figures, extras } = src;
  const cards = allCards(guide).length;
  // What the quiz can actually field, which is not the same as how many cards
  // there are: answers that clip to the same text are one option. See
  // `lib/quiz.ts`.
  const options = distinctAnswers(guide);
  const units = guide.units.length;
  const lessonCount = Object.keys(lessons).length;
  const figureCount = Object.keys(figures).length + extras.length;
  /*
   * Both halves of what the Cases tab shows. It renders the catalogue's worked
   * examples *and* the guide's claim-and-test pairings, but this counted only
   * the first, so a pairing that arrived with a reading was on the screen and
   * absent from the number above it.
   */
  const cases = (src.examples ?? cat.examples[courseId] ?? []).length + (guide.cases?.length ?? 0);
  const episodes = (cat.podcast[courseId]?.editions ?? []).length;
  /*
   * Whether a script can be written, asked the way `lib/script.ts` answers it
   * rather than guessed at from `units > 0`. A unit with no cards contributes
   * no lines, so a guide of empty units would report a script and open on an
   * empty one — which is the shape of failure every `missing` in this file is
   * here to prevent.
   */
  const script = guide.units.some((u) => u.cards.length > 0);

  return [
    {
      id: 'cards',
      label: 'Cards',
      blurb: 'Tap to flip. One question at a time, by unit or the whole guide.',
      count: plural(cards, 'card'),
      ready: cards > 0,
      missing: 'No cards yet — add a reading and they appear here.',
    },
    {
      id: 'read',
      label: 'Read',
      blurb: 'The guide as prose, unit by unit, with the glossary in place.',
      count: plural(units, 'unit'),
      ready: units > 0,
      missing: 'Nothing to read until this course has units.',
    },
    {
      id: 'field',
      label: 'Field guide',
      blurb: 'The whole thing as the published guide — masthead, sections, glossary, self-test.',
      count: plural(units, 'section'),
      ready: units > 0,
      missing: 'Nothing to read until this course has units.',
    },
    /*
     * Watch, and which of the two kinds of narration this course has.
     *
     * A recorded lesson is a voice somebody rendered with `audio/synth.py`
     * over a cue list, and a spoken one is this device reading the unit's own
     * cards. They are not the same thing and the card says which — §3.3 of
     * the completion plan: a mode that looks identical whether it has
     * forty-four produced lessons behind it or a robot voice is the exact
     * failure this file was written to end.
     *
     * The third state is the one that used to be the only one for a generated
     * course: units exist, and the browser will not speak. Then there is
     * genuinely nothing to play, and it says so in those words rather than
     * naming a Python script the reader does not have.
     */
    watch(lessonCount, units, src.canSpeak ?? canSpeak()),
    {
      id: 'slides',
      label: 'Slides',
      blurb: 'The unit as a deck — one point per slide, question before answer.',
      count: plural(units, 'deck'),
      ready: units > 0,
      missing: 'Decks are built from units, and this course has none yet.',
    },
    {
      id: 'doc',
      label: 'Doc',
      blurb: 'The whole guide as a Word file, a PDF, or a page you can print.',
      count: '3 formats',
      ready: units > 0,
      missing: 'Nothing to export yet.',
    },
    {
      id: 'quiz',
      label: 'Quiz',
      blurb: 'Multiple choice, marked as you go, wrong answers drawn from the guide.',
      count: options >= 4 ? plural(cards, 'card') + ' in play' : 'Needs 4 answers',
      ready: options >= 4,
      missing:
        'A quiz needs four different answers to make plausible wrong options, and this course does not have them yet.',
    },
    {
      id: 'figures',
      label: 'Figures',
      blurb: 'The diagrams — curves, flows and frames — with what each one shows.',
      count: plural(figureCount, 'figure'),
      ready: figureCount > 0,
      missing: 'No diagrams for this course.',
    },
    {
      id: 'cases',
      label: 'Cases',
      blurb: 'Worked examples in full, with the reasoning left in.',
      count: plural(cases, 'case'),
      ready: cases > 0,
      missing: 'No worked examples for this course.',
    },
    {
      id: 'cram',
      label: 'Cram',
      blurb: 'Everything on one page for the night before — no flipping, no waiting.',
      count: plural(units, 'unit'),
      ready: units > 0,
      missing: 'Nothing to cram yet.',
    },
    {
      id: 'listen',
      label: 'Listen',
      blurb: 'The podcast editions, with chapter marks that seek.',
      /*
       * A script is not an episode, and the card must not let them read as
       * one.
       *
       * `lib/script.ts` gives every course with cards something to open
       * Listen on — the running order and the words, written from its own
       * guide. That is worth having and it is not audio, so counting it as
       * "1 episode" would be this file's original complaint committed again:
       * a mode with a script behind it looking identical to one with three
       * recorded editions behind it, and the only way to find out being to
       * tap.
       *
       * So the count says which it is. Recorded editions are counted; a
       * course with none says it has a script and that nobody has recorded
       * it, which is both the offer and the caveat in four words.
       */
      count: episodes > 0 ? plural(episodes, 'episode') : 'Script, not recorded',
      ready: episodes > 0 || script,
      missing: 'No recordings for this course, and no cards to write a script from.',
    },
  ];
}

export function modeInfo(all: ModeInfo[], id: StudyMode): ModeInfo | undefined {
  return all.find((m) => m.id === id);
}
