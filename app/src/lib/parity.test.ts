import { describe, expect, it } from 'vitest';
import { modesFor } from './modes';
import { extraFigures, mergeFigures } from './live';
import type { Catalog } from '../data/catalog';
import type { CourseUpdate, Figure, Guide } from './types';

/**
 * Phase 2's exit criterion, which was a sentence and is now a test.
 *
 * > "no mode card in `lib/modes.ts` reports an empty state for a course the
 * > app built itself"
 *
 * Every numbered item under Phase 2 in the completion plan is struck through
 * as done, and this was the one claim nothing checked. It is the kind that
 * stops being true quietly: a twelfth mode, a stricter `ready`, a generated
 * course losing a path into one of the assembly functions, and the sentence in
 * the document keeps saying otherwise.
 *
 * ## The course this builds, and why it is built this way
 *
 * A course the app built itself is a syllabus turned into units and cards by
 * `lib/generate.ts`, plus whatever readings the student has added since. The
 * second half is not optional garnish — it is where figures, cases and
 * examples come from, through `readMaterial` → `readFigures` → `adopt` →
 * `mergeFigures`, and a course with no reading added has nothing to draw a
 * figure *of*.
 *
 * A first version of this measurement left the updates out and reported two
 * empty cards. That was a true statement about an empty course and not about
 * the one the criterion names.
 */
const READING: CourseUpdate = {
  courseId: 'gen',
  unit: 0,
  title: 'Week 6 reading',
  source: 'week6.pdf',
  body: '',
  cards: [],
  terms: [],
  // A drawn figure, which is the arm that exists so a concept outside the
  // hand-drawn kinds still gets a picture.
  figures: [
    {
      type: 'drawn',
      title: 'Titration curve',
      caption: 'pH against volume of titrant',
      language: 'mermaid',
      code: 'graph TD; A-->B;',
    } satisfies Figure,
  ],
  frames: [],
  selfTest: [],
  cases: [],
  examples: [{ tag: 'acid-base', t: 'Working one through', d: 'The arithmetic, shown.' }],
  fileIds: [],
} as unknown as CourseUpdate;

/** What `lib/generate.ts` produces from a syllabus: units and cards, no more. */
const generated = (): Guide =>
  ({
    code: 'GEN 101',
    name: 'Generated',
    blurb: '',
    source: 'pasted.pdf',
    mastery: 0,
    audio: false,
    terms: [],
    units: [
      { title: 'One', cards: [{ q: 'a', a: 'alpha' }, { q: 'b', a: 'beta' }] },
      { title: 'Two', cards: [{ q: 'c', a: 'gamma' }, { q: 'd', a: 'delta' }] },
    ],
    cases: [{ title: 'A worked one', steps: [] }],
  }) as unknown as Guide;

const cardsFor = (canSpeak: boolean) =>
  modesFor({ examples: { gen: [] }, podcast: {} } as unknown as Catalog, 'gen', {
    guide: generated(),
    lessons: {},
    figures: mergeFigures({}, [READING]),
    extras: extraFigures([], [READING], {}),
    examples: READING.examples,
    canSpeak,
  } as never);

describe('full parity, for a course the app built itself', () => {
  it('leaves no mode card empty', () => {
    const empty = cardsFor(true)
      .filter((m) => !m.ready)
      .map((m) => `${m.label}: ${m.missing}`);
    expect(empty, 'Phase 2 exit criterion').toEqual([]);
  });

  it('counts eleven of them, which is the number the document states', () => {
    // `npm run counts` writes "eleven" into the generated markers. If a
    // twelfth mode arrives, this and the criterion above move together.
    expect(cardsFor(true)).toHaveLength(11);
  });

  it('fills Figures and Cases from the reading rather than from the syllabus', () => {
    /*
     * The two that would be empty without an added reading, and the reason
     * `generate.ts` is right to give a fresh course neither: "figures,
     * examples and audio belong to a course built by hand. A generated one
     * gets them when someone adds them, not by pretending." They arrive with
     * the material, which is not pretending.
     */
    const cards = cardsFor(true);
    expect(cards.find((m) => m.id === 'figures')?.count).toBe('1 figure');
    expect(cards.find((m) => m.id === 'cases')?.count).toBe('2 cases');
  });

  it('says the one thing it cannot do is the browser’s doing, not the course’s', () => {
    /*
     * On a device with no speech synthesis, Watch has neither a recording nor
     * a voice — and that is a statement about the browser rather than about
     * the course. Asserted here rather than waved at, so the criterion above
     * stays exactly as strong as it should be and no stronger.
     */
    const empty = cardsFor(false).filter((m) => !m.ready);
    expect(empty.map((m) => m.id)).toEqual(['watch']);
    expect(empty[0].missing).toMatch(/this browser will not read aloud/);
  });
});
