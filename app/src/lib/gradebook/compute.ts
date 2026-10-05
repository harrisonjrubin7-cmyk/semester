/**
 * The arithmetic of record: whether a grading scheme is one, and what final
 * grade a student's *released* grades come to under it.
 *
 * Nothing here reads a draft. `finalGrade` is handed the released versions
 * only — `releasedFor` in `ledger.ts` is the one way to get them — so the
 * registrar's export, the student's own view and the passback all count the
 * same grades, and none of them can count one a student has not been shown.
 *
 * ## The choices, each said out loud because each is a policy
 *
 * - **Missing counts as zero; excused counts as nothing.** An excused item
 *   leaves both its score and its points out of its category.
 * - **Late is a mark, not a penalty.** The score stands as the grader entered
 *   it; a late policy is applied by entering the penalised score.
 * - **Incomplete stops the letter.** Any released incomplete makes the final
 *   letter `I`, whatever the arithmetic says, because the grade is not final.
 * - **A category with nothing released yet is left out** and the others are
 *   re-weighted over what is left, and the reason says which were left out.
 * - **Drop-lowest never drops everything**: at least one counted item stays.
 * - **The letter is read from the percentage rounded to two places**, so
 *   89.995 is 90.00 and earns what 90 earns.
 */
import type { Category, Entry, Item, LetterStep, Scheme } from './model';

const KEY = /^[a-z][a-z0-9-]{0,30}$/;

/** Whether this scheme can grade anything, and every reason it cannot. */
export function schemeProblems(s: Scheme): string[] {
  const out: string[] = [];
  if (s.categories.length === 0) out.push('A scheme needs at least one category.');
  const keys = new Set<string>();
  for (const c of s.categories) {
    if (!KEY.test(c.key)) out.push(`"${c.key}" is not a category key: lower-case letters, digits and dashes.`);
    if (keys.has(c.key)) out.push(`The category key "${c.key}" is used twice.`);
    keys.add(c.key);
    if (!c.name.trim() || c.name.trim().length > 80) out.push(`Category "${c.key}" needs a name of at most 80 characters.`);
    if (!(Number.isFinite(c.weight) && c.weight > 0)) out.push(`Category "${c.key}" needs a weight above zero.`);
    if (!(Number.isInteger(c.dropLowest) && c.dropLowest >= 0)) out.push(`Category "${c.key}" drops a whole number of items.`);
  }
  // Thousandths, as the migration's numeric(6,3) holds them: 33.333 × 3 is
  // 99.999, which is not 100, and saying so is the point.
  const total = s.categories.reduce((n, c) => n + Math.round(c.weight * 1000), 0);
  if (s.categories.length > 0 && total !== 100_000) {
    out.push(`The weights sum to ${total / 1000}, not 100.`);
  }
  out.push(...letterProblems(s.letters));
  return out;
}

export function letterProblems(letters: readonly LetterStep[]): string[] {
  const out: string[] = [];
  if (letters.length === 0) return ['A scheme needs a letter scale.'];
  letters.forEach((l, i) => {
    if (!/^[A-Z][A-Z+-]{0,2}$/.test(l.letter)) out.push(`"${l.letter}" is not a letter grade.`);
    if (!(Number.isFinite(l.min) && l.min >= 0 && l.min <= 100)) out.push(`${l.letter}'s minimum is not a percentage.`);
    if (i > 0 && !(l.min < letters[i - 1].min)) out.push(`${l.letter}'s minimum must be below ${letters[i - 1].letter}'s.`);
  });
  if (letters[letters.length - 1].min !== 0) out.push('The last letter must start at 0, so every percentage has one.');
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The letter a percentage earns: the first step whose minimum it reaches. */
export function letterFor(percent: number, letters: readonly LetterStep[]): string {
  const p = round2(percent);
  return (letters.find((l) => p >= l.min) ?? letters[letters.length - 1]).letter;
}

export interface CategoryResult {
  key: string;
  weight: number;
  /** Null when nothing in it is released and counted yet. */
  percent: number | null;
  counted: number;
  dropped: number;
  excused: number;
}

export interface FinalGrade {
  /** Null when nothing is released and counted anywhere. */
  percent: number | null;
  letter: string | null;
  categories: CategoryResult[];
  reason: string;
}

/**
 * One student's final grade from their released versions.
 *
 * `released` must be the *latest released* version per item for this one
 * student; anything else is refused by name rather than averaged in.
 */
export function finalGrade(scheme: Scheme, items: readonly Item[], released: readonly Entry[]): FinalGrade {
  const students = new Set(released.map((e) => e.studentId));
  if (students.size > 1) throw new Error('finalGrade is for one student at a time.');
  const unreleased = released.find((e) => e.status !== 'released');
  if (unreleased) throw new Error(`finalGrade was handed a ${unreleased.status} version; only released grades count.`);

  const byItem = new Map(released.map((e) => [e.itemId, e]));
  const categories = scheme.categories.map((c) => categoryResult(c, items, byItem));
  const counted = categories.filter((c) => c.percent !== null);
  const left = categories.filter((c) => c.percent === null).map((c) => c.key);

  if (counted.length === 0) {
    return { percent: null, letter: null, categories, reason: 'Nothing has been released and counted yet.' };
  }
  const weight = counted.reduce((n, c) => n + c.weight, 0);
  const percent = round2(counted.reduce((n, c) => n + (c.weight * (c.percent ?? 0)), 0) / weight);
  const incomplete = released.some((e) => e.mark === 'incomplete');
  const letter = incomplete ? 'I' : letterFor(percent, scheme.letters);
  const reason = [
    incomplete ? 'An item is marked incomplete, so the letter is I until it is resolved.' : `${percent}% earns ${letter}.`,
    left.length ? `Nothing released yet in ${left.join(', ')}; the other categories are re-weighted.` : '',
  ].filter(Boolean).join(' ');
  return { percent, letter, categories, reason };
}

function categoryResult(c: Category, items: readonly Item[], byItem: ReadonlyMap<string, Entry>): CategoryResult {
  const scored: { score: number; points: number }[] = [];
  let excused = 0;
  for (const it of items.filter((i) => i.categoryKey === c.key)) {
    const e = byItem.get(it.id);
    if (!e) continue;
    if (e.mark === 'excused' || e.mark === 'incomplete') {
      excused += e.mark === 'excused' ? 1 : 0;
      continue;
    }
    const score = e.mark === 'missing' ? 0 : e.score;
    if (score === null) continue;
    scored.push({ score, points: it.pointsPossible });
  }
  const drop = Math.min(c.dropLowest, Math.max(0, scored.length - 1));
  const kept = [...scored].sort((a, b) => a.score / a.points - b.score / b.points).slice(drop);
  const points = kept.reduce((n, k) => n + k.points, 0);
  return {
    key: c.key,
    weight: c.weight,
    percent: points > 0 ? (kept.reduce((n, k) => n + k.score, 0) / points) * 100 : null,
    counted: kept.length,
    dropped: drop,
    excused,
  };
}
