/**
 * How much study material to make, at what level, and how many questions.
 *
 * The generator has always taken a syllabus, a reading and a year, and made
 * one thing: whatever it judged the material supported, at the register the
 * material was written in. That is the right default and it was the only
 * option. A student cramming the night before an exam and a student meeting a
 * course for the first time want opposite things out of the same reading, and
 * neither of them could ask for it.
 *
 * ## What a control may not do
 *
 * Difficulty is the dangerous one, and it is why this file is prose as well as
 * numbers. "Harder" must mean *ask more of the material* — a question that
 * makes you connect two things the reading actually contains — and never
 * *invent harder material*. A model asked for a harder question about a
 * reading that does not support one will happily supply an exam question about
 * something the reading never said, and it will look exactly like the good
 * ones. That is worse than an easy deck, because it is a false statement about
 * the course sitting in the thing you revise from.
 *
 * So every register below is phrased as an instruction about *selection and
 * wording*, and `shapeSays` closes with the refusal in every case. The
 * no-invention rules in `lib/generate.ts` and `lib/claude.ts` still run
 * underneath; these never loosen them.
 *
 * ## Ceilings, not targets
 *
 * Every number here is "0 to N", never "make N". `lib/study.ts` explains why
 * the cram sheet has a ceiling at all: a model asked for frames without one
 * produces a frame per paragraph, and a cram sheet you cannot read in an hour
 * is not a cram sheet. Choosing `full` raises the ceiling; it does not oblige
 * the material to fill it, and a thin reading still returns three cards.
 */

/** How much comes out. */
export type Depth = 'brief' | 'standard' | 'full';

/** What register the questions are written at. */
export type Level = 'plainer' | 'course' | 'harder';

export interface Controls {
  depth: Depth;
  level: Level;
  /**
   * How many cards to ask for at most.
   *
   * Zero means "as many as the material supports", which is the default and
   * is what the app did before this existed. A number is a ceiling, never a
   * quota — see the note above.
   */
  cards: number;
}

export const DEFAULTS: Controls = { depth: 'standard', level: 'course', cards: 0 };

/** The most of each kind to ask for. */
export interface Caps {
  cards: number;
  terms: number;
  frames: number;
  tests: number;
  cases: number;
  examples: number;
  figures: number;
}

/**
 * The ceilings as they have always been — `standard`, and the default.
 *
 * `cards` and `terms` were literals inside the prompt in `lib/claude.ts`, four
 * were `MOST` in `lib/study.ts`, and figures were `MOST_FIGURES` in
 * `lib/figure.ts`. Three homes for one idea, and changing "how much" meant
 * knowing about all of them. One table now; the others read this rather than
 * keeping their own.
 */
export const MOST: Caps = { cards: 25, terms: 20, frames: 6, tests: 8, cases: 3, examples: 4, figures: 3 };

/** The most a student may ask for by hand, whatever the depth. */
export const MOST_CARDS = 50;

const SCALE: Record<Depth, number> = {
  // A third, near enough. Few enough to read on a bus, which is what "brief"
  // is for; never zero, because a depth that can return nothing is a broken
  // control rather than a short one.
  brief: 0.35,
  standard: 1,
  // Half again. Deliberately not double: the ceiling in `lib/study.ts` is
  // there because a cram sheet twice as long stops being a cram sheet, and
  // "full" is a student asking for more of the material, not for a book.
  full: 1.5,
};

/** One kind's ceiling at a given depth. Never below one. */
function scaled(most: number, depth: Depth): number {
  return Math.max(1, Math.round(most * SCALE[depth]));
}

/**
 * The ceilings these controls ask for.
 *
 * `cards` is the one a student can name directly, so an explicit count wins
 * over the depth for that kind and leaves every other kind on the depth. That
 * is the behaviour somebody setting "30 cards, brief" is asking for: thirty
 * cards, and a short cram sheet beside them.
 */
export function capsFor(c: Controls = DEFAULTS): Caps {
  const chosen = Math.round(c.cards);
  const cards =
    chosen > 0 ? Math.min(MOST_CARDS, Math.max(1, chosen)) : scaled(MOST.cards, c.depth);
  return {
    cards,
    terms: scaled(MOST.terms, c.depth),
    frames: scaled(MOST.frames, c.depth),
    tests: scaled(MOST.tests, c.depth),
    cases: scaled(MOST.cases, c.depth),
    examples: scaled(MOST.examples, c.depth),
    figures: scaled(MOST.figures, c.depth),
  };
}

const DEPTH_SAYS: Record<Depth, string> = {
  brief:
    'Keep it short. Take only what the material makes most of — the ideas it returns to, the ' +
    'numbers it repeats — and leave out the rest rather than covering everything thinly.',
  standard: '',
  full:
    'Cover the material thoroughly: the secondary points and the worked detail as well as the ' +
    'spine, so long as each one is genuinely in the text.',
};

const LEVEL_SAYS: Record<Level, string> = {
  plainer:
    'Write for somebody meeting this for the first time: define each term where it first appears, ' +
    'and answer in plain language rather than in the material’s own vocabulary.',
  course: '',
  harder:
    'Ask the hardest questions the material genuinely supports — ones that make the answer connect ' +
    'two things the text actually contains, or work through a step rather than recall a fact.',
};

/**
 * The controls as instructions to put in a prompt, or nothing.
 *
 * Returns an empty string on the defaults, so the prompt is byte-for-byte what
 * it was before this file existed for every student who has not touched a
 * control. That is deliberate: the default path is the one that has been read,
 * argued over and shipped, and it should not quietly change because a settings
 * screen appeared.
 *
 * The refusal is attached to `harder` rather than to every register, because
 * it is the only one that creates the pressure: nothing about "plainer" tempts
 * a model to invent, and everything about "the hardest question" does.
 */
export function shapeSays(c: Controls = DEFAULTS): string {
  const parts = [DEPTH_SAYS[c.depth], LEVEL_SAYS[c.level]].filter(Boolean);
  if (parts.length === 0) return '';
  if (c.level === 'harder') {
    parts.push(
      'Harder means asking more of the material, never inventing material to ask about: if the ' +
        'text does not support a harder question on a topic, write the one it does support or ' +
        'none at all.',
    );
  }
  return parts.join(' ');
}

/** How many of each, spelled out for the prompt. */
export function countsSay(caps: Caps): string {
  return `At most ${caps.cards} cards and ${caps.terms} terms.`;
}

/** What these controls will do, in one line, for the screen that sets them. */
export function line(c: Controls = DEFAULTS): string {
  const caps = capsFor(c);
  const depth =
    c.depth === 'brief' ? 'Only the spine' : c.depth === 'full' ? 'Thorough' : 'The usual amount';
  const level =
    c.level === 'plainer'
      ? 'in plain language'
      : c.level === 'harder'
        ? 'at the hardest the material supports'
        : 'at the course’s own level';
  const many =
    c.cards > 0
      ? `up to ${caps.cards} cards, as asked`
      : `up to ${caps.cards} cards, however many it supports`;
  return `${depth}, ${level} — ${many}.`;
}
