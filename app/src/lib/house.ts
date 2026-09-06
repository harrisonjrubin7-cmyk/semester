import type { CourseUpdate, Guide, StudyCard, Unit } from './types';

/**
 * What this course's material already looks like, so new material matches it.
 *
 * The step most likely to be skipped, and the one that decides whether an
 * import reads as part of the course or as something bolted on. A generic
 * template produces cards that are all the same length and all phrased the
 * same way, and a student flicking through a deck can tell within three
 * which ones the app wrote.
 *
 * So nothing here is a template. It reads the course's own units and cards and
 * describes them — how long an answer runs, whether a front is a question or a
 * term, how a unit is named, whether an answer opens with a definition — and
 * hands that description to the generator as the shape to match.
 *
 * ## Measured, then shown
 *
 * Both halves matter. The measurements are what a model can actually follow —
 * "answers run about 150 characters" is actionable in a way that "match the
 * voice" is not. The samples are what carries everything no measurement
 * catches: the em dashes, the second person, the habit of ending on the thing
 * that costs marks.
 *
 * Where a course has nothing to sample — a course imported this morning, or
 * one whose guide is still empty — `describe` says so, and the caller falls
 * back to the app's general voice rather than inventing a house style for a
 * house that does not exist yet.
 */

export interface House {
  /** Enough of the real thing to imitate. Empty when there is nothing yet. */
  samples: string;
  /** The measurements, as instructions. Empty when the sample is too thin. */
  rules: string[];
  /** How many cards the measurements rest on. Below `ENOUGH_CARDS`, none. */
  from: number;
}

/**
 * How many cards it takes before a measurement means anything.
 *
 * Four cards can be four accidents. The brief asks for five to ten, and ten is
 * where the median stops moving much on the courses in the app.
 */
const ENOUGH_CARDS = 5;

/** Cards drawn from across the guide rather than all from one unit. */
function spread(units: Unit[], want: number): { card: StudyCard; unit: string }[] {
  const withCards = units.filter((u) => u.cards.length > 0);
  if (withCards.length === 0) return [];
  const out: { card: StudyCard; unit: string }[] = [];
  // One from each unit in turn, round-robin, so the sample is not the whole of
  // a single unit — which would teach the shape of that unit and not the
  // course.
  for (let round = 0; out.length < want; round += 1) {
    let added = false;
    for (const u of withCards) {
      if (out.length >= want) break;
      const card = u.cards[round];
      if (!card) continue;
      out.push({ card, unit: u.name });
      added = true;
    }
    if (!added) break;
  }
  return out;
}

const median = (ns: number[]): number => {
  if (ns.length === 0) return 0;
  const sorted = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

/** A front that ends in a question mark, or opens with a question word. */
const asksAQuestion = (q: string) => /\?\s*$/.test(q.trim()) || /^(what|why|how|when|which|who)\b/i.test(q.trim());

/**
 * Read the course's own shape.
 *
 * `updates` is included because material added since the import is as much
 * this course's material as the syllabus was — and after a term of imports it
 * is most of it.
 */
export function describe(guide: Guide, updates: CourseUpdate[] = []): House {
  const units = [
    ...guide.units,
    ...updates.map((u) => ({ name: u.title, mastery: 0, cards: u.cards })),
  ].filter((u) => u.cards.length > 0);

  const cards = spread(units, 10);
  const from = cards.length;

  if (from < ENOUGH_CARDS) {
    return { samples: '', rules: [], from };
  }

  const answers = cards.map((c) => c.card.a.length);
  const fronts = cards.map((c) => c.card.q.length);
  const questions = cards.filter((c) => asksAQuestion(c.card.q)).length;

  const rules: string[] = [];
  rules.push(
    `Answers in this course run about ${median(answers)} characters — write to that length, not longer.`,
  );
  rules.push(
    `Fronts run about ${median(fronts)} characters and ${
      questions > from * 0.7
        ? 'are written as questions'
        : questions < from * 0.3
          ? 'are written as short prompts or terms rather than as questions'
          : 'are a mix of questions and short prompts'
    }.`,
  );

  // How units are named. A course numbering its units is the commonest
  // pattern and the easiest to get wrong — a new unit called "Conjoint
  // analysis" in a guide of "7 · Segmentation" reads as an intruder.
  const named = guide.units.map((u) => u.name);
  const numbered = named.filter((n) => /^\s*\d+\s*[·.:—-]/.test(n)).length;
  if (numbered > named.length * 0.6 && named.length > 2) {
    rules.push(
      'Units are numbered in the form "7 · Segmentation, targeting, positioning". A new unit must follow it and take the next free number.',
    );
  }

  const dashes = cards.filter((c) => /—/.test(c.card.a)).length;
  if (dashes > from * 0.4) {
    rules.push('Answers here use the em dash to attach a qualification. Keep that habit.');
  }

  const second = cards.filter((c) => /\byou\b|\byour\b/i.test(c.card.a)).length;
  if (second > from * 0.4) {
    rules.push('Answers address the student as "you". Keep that.');
  }

  const samples = [
    'Units in this course:',
    ...guide.units.slice(0, 5).map((u) => `- ${u.name}`),
    '',
    'Cards from across this course — match their length, their phrasing and their voice:',
    ...cards.map((c) => `Q: ${c.card.q}\nA: ${c.card.a}`),
    ...(guide.terms.length > 0
      ? ['', 'Definitions as this course writes them:', ...guide.terms.slice(0, 3).map((t) => `${t.t} — ${t.d}`)]
      : []),
  ].join('\n');

  return { samples, rules, from };
}

/**
 * The house style as one block for a prompt, or the fallback when there is none.
 *
 * The fallback is the app's own voice and is stated rather than assumed: a
 * course with nothing to sample still needs to be told not to write like a
 * textbook advertisement.
 */
export function styleFor(house: House): string {
  if (house.from < ENOUGH_CARDS) {
    return [
      'This course has too little material to imitate, so write in the app’s own voice:',
      'plain, direct, second person, no exclamation marks, no marketing register. Answer in full',
      'prose with the specific numbers, names, dates and steps the material gives.',
    ].join(' ');
  }
  return [
    `Match this course’s existing material. Read these ${house.from} cards before writing anything,`,
    'and write so that yours would not stand out among them.',
    '',
    house.samples,
    '',
    'What that comes down to:',
    ...house.rules.map((r) => `- ${r}`),
  ].join('\n');
}
