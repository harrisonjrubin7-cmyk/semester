import type { Screen, StudyMode } from './types';

/**
 * The things this app does that are not places you can go to.
 *
 * `lib/nav.ts` is the registry of screens, and `findable.test.ts` makes sure
 * every screen is in it — which is why typing "gmail" reaches the mail screen.
 * But a great deal of what this app is for is not a screen. Listen is a way
 * through a course, not a destination; the teach-back journal is a panel on
 * the Study screen; the focus timer is half of Clocks. None of them has a row
 * in `DESTINATIONS`, because none of them is somewhere you arrive.
 *
 * Which meant search could not see them. Measured against the four shipped
 * courses before this file existed:
 *
 *   "podcast"            0 results, and the app has ten podcast editions
 *   "cram sheet"         0 results, and Cram is a mode with a screen of its own
 *   "listen"             0 results, for the mode literally called Listen
 *   "field guide"        0
 *   "narrated lesson"    0, and there are 44 of them
 *   "worked examples"    0, and Cases is nothing else
 *   "mistake journal"    0
 *   "teach back"         1 result: the Costs screen
 *
 * That last one is the worst of them and is why this is not filed as "add
 * some keywords". A search that answers "teach back" with a screen about
 * money has not failed to find something — it has said something false, in a
 * confident voice, about an app that has exactly that feature. The near-miss
 * tier in `find.ts` is doing what it was built to do; the reason it gets to
 * answer at all is that nothing true was in the index to outrank it.
 *
 * ## Why a registry and not eleven more keywords on the Study screen
 *
 * Because "podcast" should answer **Listen**, with a sentence about what
 * Listen is, and not answer "Study" and leave the person to find it. The
 * sentence is the part that matters: somebody who types "podcast" does not
 * know this app calls it Listen, and a result that just says "Study" teaches
 * them the search does not work even when it has technically worked.
 *
 * ## Where one of these lands
 *
 * On the screen it lives in, which for every mode is Study. Not on the mode
 * itself: a mode is a way through *a course*, and the search box does not
 * know which course is meant. Study already answers that better than a guess
 * would — it lists every course with the modes that actually have something
 * behind them, which is the whole point of `lib/modes.ts`. Sending somebody
 * straight to Listen for a course with no editions would be the "tap and be
 * told no" that file was written to end.
 */
export interface Doing {
  /** Stable, and for a mode it is the `StudyMode` id. */
  id: string;
  /** What the app calls it. For a mode, exactly what `lib/modes.ts` calls it. */
  label: string;
  /** What it is, in one line — the part a person who searched a synonym reads. */
  blurb: string;
  /**
   * The words somebody would actually type, which are mostly not the label.
   *
   * Nobody searches "Listen" for a podcast, "Cases" for a worked example or
   * "Cram" for a revision sheet. Every zero in the list at the top of this
   * file was a word a person would use for a thing this app has.
   */
  keywords: string;
  /** Where it lives. Pressing the result goes here. */
  screen: Screen;
  /** Said on the result, so it is clear this is a part of a screen. */
  within: string;
  /** Set when this is one of the eleven ways through a course. */
  mode?: StudyMode;
}

/**
 * The eleven modes, then the panels.
 *
 * Every `StudyMode` has to be here — `doing.test.ts` reads the union in
 * `types.ts` and fails on one that is missing, the same shape of guard as
 * `findable.test.ts` over the screens. The labels are checked against
 * `lib/modes.ts` by the same test rather than trusted, because a mode renamed
 * in one file and not the other is a search result for a name that is no
 * longer on any screen.
 */
export const DOING: Doing[] = [
  {
    id: 'cards',
    label: 'Cards',
    blurb: 'Tap to flip. One question at a time, by unit or the whole guide.',
    keywords: 'flashcards flash cards anki revise memorise memorize drill recall spaced repetition',
    screen: 'study',
    within: 'In Study',
    mode: 'cards',
  },
  {
    id: 'read',
    label: 'Read',
    blurb: 'The guide as prose, unit by unit, with the glossary in place.',
    keywords: 'reading prose text notes glossary definitions study guide',
    screen: 'study',
    within: 'In Study',
    mode: 'read',
  },
  {
    id: 'field',
    label: 'Field guide',
    blurb: 'The whole thing as the published guide — masthead, sections, glossary, self-test.',
    keywords: 'handbook manual reference whole guide everything one document self test',
    screen: 'study',
    within: 'In Study',
    mode: 'field',
  },
  {
    id: 'watch',
    label: 'Watch',
    blurb: 'A narrated lesson per unit, the slide changing as the voice moves.',
    keywords: 'video lesson lecture narrated narration voice tutorial explainer watch it read aloud',
    screen: 'study',
    within: 'In Study',
    mode: 'watch',
  },
  {
    id: 'slides',
    label: 'Slides',
    blurb: 'The unit as a deck — one point per slide, question before answer.',
    keywords: 'deck presentation powerpoint keynote slideshow one point per slide',
    screen: 'study',
    within: 'In Study',
    mode: 'slides',
  },
  {
    id: 'doc',
    label: 'Doc',
    blurb: 'The whole guide as a Word file, a PDF, or a page you can print.',
    keywords: 'word docx pdf print printable handout download the guide paper copy',
    screen: 'study',
    within: 'In Study',
    mode: 'doc',
  },
  {
    id: 'quiz',
    label: 'Quiz',
    blurb: 'Multiple choice, marked as you go, wrong answers drawn from the guide.',
    keywords: 'test me practice questions multiple choice mcq self test exam practice quiz myself',
    screen: 'study',
    within: 'In Study',
    mode: 'quiz',
  },
  {
    id: 'figures',
    label: 'Figures',
    blurb: 'The diagrams — curves, flows and frames — with what each one shows.',
    keywords: 'diagram diagrams chart charts graph graphs curve curves illustration visual',
    screen: 'study',
    within: 'In Study',
    mode: 'figures',
  },
  {
    id: 'cases',
    label: 'Cases',
    blurb: 'Worked examples in full, with the reasoning left in.',
    keywords: 'worked example worked examples case study problem solved step by step model answer',
    screen: 'study',
    within: 'In Study',
    mode: 'cases',
  },
  {
    id: 'cram',
    label: 'Cram',
    blurb: 'Everything on one page for the night before — no flipping, no waiting.',
    keywords: 'cram sheet cheat sheet revision sheet one pager summary night before last minute',
    screen: 'study',
    within: 'In Study',
    mode: 'cram',
  },
  {
    id: 'listen',
    label: 'Listen',
    blurb: 'The podcast editions, with chapter marks that seek.',
    keywords: 'podcast podcasts episode episodes audio mp3 headphones walking commute chapters',
    screen: 'study',
    within: 'In Study',
    mode: 'listen',
  },

  /*
   * The panels. Each is a named thing on a screen with a heading of its own,
   * which is the test for belonging here: if it has a name a person could
   * search, it needs to be findable by that name.
   */
  {
    id: 'teachback',
    label: 'Teach-back practice and mistake journal',
    blurb:
      'Explain it before you open the reference, then record what you missed and when to revisit it.',
    keywords:
      'teach back teachback explain it back feynman practice explaining mistake journal ' +
      'study journal error log what I got wrong reflection private notes on mistakes',
    screen: 'study',
    within: 'In Study',
  },
];

/*
 * One entry was written and taken out again, and the reason is the rule this
 * file has to hold to.
 *
 * "Focus timer → Clocks" looked obviously right and was false twice over.
 * `screens/Clocks.tsx` says in its own header that it is a *kitchen* timer and
 * that nothing on it touches your pace, your grades or your deadlines — "the
 * point" of it, in that file's words. The timer that does belong to work is
 * `components/Timer.tsx`, and it attaches to one piece of work rather than
 * standing anywhere: you reach it through the deadline it is timing, which is
 * not a place this could send anybody.
 *
 * So there is no focus timer to be findable, and an entry claiming one would
 * have been the same fault as the Costs screen answering "teach back" — a
 * confident false answer — with the search's own registry as the source
 * instead of a near miss. Everything in the list above was opened in the app
 * and looked at before it was written down.
 */
