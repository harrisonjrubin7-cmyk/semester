/**
 * The ten ways through a course, described.
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
import type { CourseId, Guide, StudyMode } from './types';

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
  guide: Guide;
  lessons: Record<number, unknown>;
  figures: Record<number, unknown>;
  extras: unknown[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function modesFor(cat: Catalog, courseId: CourseId, src: Source): ModeInfo[] {
  const { guide, lessons, figures, extras } = src;
  const cards = allCards(guide).length;
  const units = guide.units.length;
  const lessonCount = Object.keys(lessons).length;
  const figureCount = Object.keys(figures).length + extras.length;
  const cases = (cat.examples[courseId] ?? []).length;
  const episodes = (cat.podcast[courseId]?.editions ?? []).length;

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
      id: 'watch',
      label: 'Watch',
      blurb: 'A narrated lesson per unit, the slide changing as the voice moves.',
      count: plural(lessonCount, 'lesson'),
      ready: lessonCount > 0,
      missing: 'No lessons rendered for this course.',
    },
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
      count: cards >= 4 ? plural(cards, 'card') + ' in play' : 'Needs 4 cards',
      ready: cards >= 4,
      missing: 'A quiz needs at least four cards to make plausible wrong answers.',
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
      count: plural(episodes, 'episode'),
      ready: episodes > 0,
      missing: 'No recordings for this course.',
    },
  ];
}

export function modeInfo(all: ModeInfo[], id: StudyMode): ModeInfo | undefined {
  return all.find((m) => m.id === id);
}
