import { allCards } from '../data/catalog';
import type { DeckCard } from '../data/catalog';
import type { Guide } from './types';
import type { QuizQuestion } from '../state/store';
import { judge, normalise } from './word';

/**
 * Long answers are clipped so four options fit on a phone without scrolling
 * past the question.
 *
 * At module scope because the clip is what the student actually reads, so it
 * is also what "two options are the same" has to be judged on. See below.
 */
function clip(text: string): string {
  return text.length > 118 ? `${text.slice(0, 116).replace(/[ ,;—]+$/, '')}…` : text;
}

/**
 * How many genuinely different options this guide can offer.
 *
 * Counted on the clipped text rather than the raw answer, because two answers
 * sharing a long opening — which formulaic ones do — are one option by the
 * time they reach the screen.
 *
 * The Study screen asks this before offering the mode at all: a quiz that can
 * only field two options is a coin toss with a score attached, and finding
 * that out costs a tap. See `lib/modes.ts`.
 */
export function distinctAnswers(guide: Guide): number {
  return new Set(allCards(guide).map((c) => clip(c.a))).size;
}

/** How many term/definition pairs one matching question joins up. */
export const MATCH_PAIRS = 4;

/**
 * Whether this guide's key terms can field a matching question.
 *
 * Both sides have to be distinct, and for the same reason the options do: a
 * matching question with two identical definitions on the right is one a
 * student can get wrong while being right, which is worse than not asking.
 */
export function matchableTerms(guide: Guide): { t: string; d: string }[] {
  const seenT = new Set<string>();
  const seenD = new Set<string>();
  const out: { t: string; d: string }[] = [];
  for (const term of guide.terms ?? []) {
    const t = term.t.trim();
    const d = clip(term.d.trim());
    if (!t || !d || seenT.has(t) || seenD.has(d)) continue;
    seenT.add(t);
    seenD.add(d);
    out.push({ t, d });
  }
  return out;
}

/**
 * How many characters a typed answer may run to before it stops being one.
 *
 * A term is a thing you can produce from memory in a box; a sentence is not.
 * Thirty-two is where the four shipped glossaries stop being names and start
 * being descriptions — `Operational definition` is 22 and `Spurious
 * relationship` is 23, and the entries longer than this are the formula-sheet
 * headings that nobody types.
 */
const TYPEABLE = 32;

/**
 * Which of a guide's key terms can honestly be asked for by typing.
 *
 * Three things disqualify one, and the third is the one that took looking at
 * real guides to find:
 *
 *  1. **Too long to type.** See {@link TYPEABLE}.
 *  2. **A definition that is not a question.** An empty one asks nothing.
 *  3. **A definition containing the term.** `Coverage error — the sampling
 *     frame leaves out part of the population` is fine; a definition that says
 *     the word back is a question whose answer is printed underneath it, and
 *     marking somebody right for reading is worse than not asking.
 *
 * Compared on the *normalised* forms, so a definition that echoes the term in
 * lower case or without its hyphen is caught too — which is how it is usually
 * written when it happens at all.
 */
export function wordableTerms(guide: Guide): { t: string; d: string }[] {
  const seen = new Set<string>();
  const out: { t: string; d: string }[] = [];
  for (const term of guide.terms ?? []) {
    const t = term.t.trim();
    const d = term.d.trim();
    if (!t || !d || t.length > TYPEABLE) continue;
    const key = normalise(t);
    if (!key || seen.has(key)) continue;
    // The giveaway check. `normalise` puts both sides in the same form, so
    // this catches the echo however it was capitalised or punctuated.
    if (` ${normalise(d)} `.includes(` ${key} `)) continue;
    seen.add(key);
    out.push({ t, d });
  }
  return out;
}

/**
 * One typed-answer question from the guide's key terms, or nothing.
 *
 * The definition is the question and the term is the answer, which is the
 * direction that can be marked. The other way round — show the term, ask for
 * the definition — is the more natural thing to ask a person and cannot be
 * marked by any means in this repository: a definition in somebody's own words
 * is right, and no edit distance says so.
 *
 * `others` is every other askable term in the same guide, carried on the
 * question so the marker can refuse a near miss that is also a near miss for
 * one of them. Across the four shipped guides exactly one pair needs it, and
 * it is `External validity` and `Internal validity` — see `lib/word.test.ts`,
 * which measures that rather than asserting it.
 */
function wordFrom(
  pool: { t: string; d: string }[],
  all: { t: string; d: string }[],
  rnd: () => number,
): QuizQuestion | null {
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(rnd() * pool.length)];
  return {
    kind: 'word',
    q: pick.d,
    unit: 'Key terms',
    full: pick.t,
    opts: [],
    /*
     * The rivals come from `all`, not from `pool`.
     *
     * `pool` shrinks as the run asks its questions, and building the list from
     * it made the guard weaker on the second question than on the first: a
     * term already asked was no longer a rival, so an answer ambiguous between
     * it and this one would have been marked right. Nothing on screen would
     * have shown it, and a test that only looked at the first question would
     * not have either — this is `quiz.test.ts` counting the list against the
     * guide's own terms rather than against whatever was left.
     */
    others: all.filter((o) => o.t !== pick.t).map((o) => o.t),
  };
}

/** A seeded shuffle, in place, using the run's own generator. */
function shuffle<T>(list: T[], rnd: () => number): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * One multiple-choice question from a card, or nothing.
 *
 * Split out of `buildQuiz` when the run learned other kinds, so the rule this
 * carries — three distinct decoys or no question at all — stays in one place
 * rather than being restated per kind.
 */
function choiceFrom(card: DeckCard, all: DeckCard[], rnd: () => number): QuizQuestion | null {
  const right = clip(card.a);
  const wrong: string[] = [];
  /*
   * Held as clipped text, not as the raw answer.
   *
   * Two answers that share their first hundred-odd characters are two
   * different strings and one option: de-duplicating on the raw answer let
   * both through, so a question could show the same sentence twice with one
   * copy marked correct. Somebody picking the identical-looking option was
   * marked wrong by a quiz that had asked them to tell two things apart
   * while showing them the same thing.
   */
  const seen = new Set<string>([right]);
  let guard = 0;
  while (wrong.length < 3 && guard < 400) {
    guard++;
    const candidate = clip(all[Math.floor(rnd() * all.length)].a);
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    wrong.push(candidate);
  }

  // A guide with too few different answers cannot make a fourth option, and
  // a two-option "multiple choice" is a coin toss with a score attached.
  // Better to ask nothing than to ask that.
  if (wrong.length < 3) return null;

  const opts = shuffle(
    [...wrong.map((a) => ({ text: a, ok: false })), { text: right, ok: true }],
    rnd,
  );

  return { kind: 'choice', q: card.q, unit: card.unit, full: card.a, opts };
}

/**
 * One true-or-false question from a card, or nothing.
 *
 * The statement is the card's own question with an answer proposed under it —
 * either the answer that belongs to it, or one borrowed from another card.
 * That is the same trick the multiple-choice decoys turn: a borrowed answer is
 * true of something, so rejecting it is the discrimination the exam asks for,
 * not a sniff test for nonsense.
 *
 * Nothing rather than a question when no borrowed answer reads differently
 * from the real one. A true-or-false whose false half is the right answer in
 * other words marks a student wrong for being right, and unlike a fourth
 * option nobody can see it coming.
 */
function trueFalseFrom(
  card: DeckCard,
  all: DeckCard[],
  rnd: () => number,
): QuizQuestion | null {
  const right = clip(card.a);
  const holds = rnd() < 0.5;

  let claim = right;
  if (!holds) {
    let guard = 0;
    let borrowed = '';
    while (!borrowed && guard < 400) {
      guard++;
      const candidate = clip(all[Math.floor(rnd() * all.length)].a);
      if (candidate !== right) borrowed = candidate;
    }
    if (!borrowed) return null;
    claim = borrowed;
  }

  return {
    kind: 'truefalse',
    q: card.q,
    unit: card.unit,
    full: card.a,
    claim,
    opts: [
      { text: 'True', ok: holds },
      { text: 'False', ok: !holds },
    ],
  };
}

/**
 * One matching question from the guide's key terms, or nothing.
 *
 * `pairs` is the truth, in order. `shown` is the order the definitions are
 * drawn in — indexes into `pairs` — so the right-hand column is scrambled
 * without the answer having to be stored twice or recovered by searching.
 *
 * Capped at one per run by the caller: four pairs is already the longest
 * single act of reading in the quiz, and two of them in ten questions turns a
 * recall drill into a puzzle.
 */
function matchFrom(terms: { t: string; d: string }[], rnd: () => number): QuizQuestion | null {
  if (terms.length < MATCH_PAIRS) return null;
  const picked = shuffle([...terms], rnd).slice(0, MATCH_PAIRS);
  const pairs = picked.map((p) => ({ left: p.t, right: p.d }));

  /*
   * A scramble that is allowed to come back in order.
   *
   * Forcing a derangement would make "already lined up" a reliable signal
   * that the ordering is wrong, which is a hint the question did not mean to
   * give. One chance in twenty-four is a coincidence, not a tell.
   */
  const shown = shuffle(
    pairs.map((_, i) => i),
    rnd,
  );

  return {
    kind: 'match',
    q: 'Match each term to its definition.',
    unit: 'Key terms',
    full: pairs.map((p) => `${p.left} — ${p.right}`).join('\n'),
    opts: [],
    pairs,
    shown,
  };
}

/** At most this many true-or-false questions in a run of ten. */
const TRUE_FALSE = 3;

/**
 * At most this many typed-answer questions in a run of ten.
 *
 * Two, and the number is a claim about attention rather than about marking. A
 * typed answer is the slowest question in the run — a keyboard comes up, the
 * thumb leaves the answer area, and the reward for getting it right is the
 * same one tapping gives. Two of them is the hardest part of a run; five would
 * be the run, and a student who wanted to be typing would be using the drill.
 */
const WORD_ANSWERS = 2;

/**
 * Up to ten questions drawn from the guide — multiple choice, true-or-false,
 * and one round of matching where the key terms allow it.
 *
 * The decoys, on every kind that has them, are real answers to other questions
 * in the same guide, which is what makes the exercise worth doing — the wrong
 * options are all plausible and all true of something, so recognising the
 * right one is the same discrimination the exam asks for. Seeded so a run is
 * reproducible but each new run differs.
 *
 * "Up to", because a question that cannot be asked honestly is dropped rather
 * than asked badly: three distinct decoys for a choice, a borrowed answer that
 * reads differently for a true-or-false, four distinct terms for a match.
 *
 * ## Why one card never appears twice in a run
 *
 * A card asked as a choice and again as a true-or-false is the same question
 * with the answer already given away by the first of them. The pools are
 * therefore cut from one shuffled deck rather than drawn independently.
 */
export function buildQuiz(guide: Guide, seed: number): QuizQuestion[] {
  const all = allCards(guide);
  if (all.length === 0) return [];

  /*
   * A guide too thin for a multiple choice gets no quiz at all, and that
   * includes the kinds that would fit in it.
   *
   * True-or-false is a two-option question, which is the exact shape this
   * file has always refused to ask — "a coin toss with a score attached".
   * The difference is that a true-or-false says so, and a student reading
   * one knows the odds they are being offered; a four-option question with
   * two real options lies about them. That makes it a fair *part* of a run
   * and a bad *whole* one, so it supplements the choice questions rather
   * than standing in for them when there are none.
   *
   * Gated on the same number `lib/modes.ts` gates the mode on, so that the
   * Study screen offering a quiz and this function returning one cannot
   * disagree.
   */
  if (distinctAnswers(guide) < 4) return [];

  let s = (seed * 9301) % 233280 || 1;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const out: QuizQuestion[] = [];

  const match = matchFrom(matchableTerms(guide), rnd);
  if (match) out.push(match);

  /*
   * Typed answers, off the same glossary the match came from.
   *
   * Drawn without replacement so one run cannot ask for the same term twice,
   * which is the typed-answer version of the "no card twice" rule below: the
   * second asking is the first one with the answer already given.
   */
  const askable = wordableTerms(guide);
  const pool = [...askable];
  for (let i = 0; i < WORD_ANSWERS && pool.length > 0; i++) {
    const word = wordFrom(pool, askable, rnd);
    if (!word) break;
    out.push(word);
    const at = pool.findIndex((t) => t.t === word.full);
    if (at >= 0) pool.splice(at, 1);
  }

  const shuffled = shuffle([...all], rnd);

  /*
   * True-or-false first, off the front of the shuffled deck.
   *
   * Off the front rather than by picking at random from the whole deck,
   * because the cards it consumes have to be the ones the choice pass then
   * does not see. Taking a slice is how "no card twice" is enforced rather
   * than checked afterwards.
   *
   * Skipped outright on a deck with one distinct answer: there is no second
   * answer to borrow, so every statement would be true and the question would
   * be a formality with a score attached.
   */
  const enough = new Set(all.map((c) => clip(c.a))).size >= 2;
  const wantTF = enough ? Math.min(TRUE_FALSE, Math.max(0, 10 - out.length - 1)) : 0;

  let used = 0;
  let made = 0;
  for (const card of shuffled) {
    if (made >= wantTF) break;
    used++;
    const tf = trueFalseFrom(card, all, rnd);
    if (tf) {
      out.push(tf);
      made++;
    }
  }

  for (const card of shuffled.slice(used)) {
    if (out.length >= 10) break;
    const choice = choiceFrom(card, all, rnd);
    if (choice) out.push(choice);
  }

  return shuffle(out, rnd);
}

/**
 * Whether every term in a matching question has been given a definition.
 *
 * Here rather than on the screen because the reducer needs the same answer:
 * two definitions of "finished" is how a question gets scored twice, or
 * scored and then still accepting taps.
 */
export function matchDone(
  question: QuizQuestion | undefined,
  joins: Record<number, number>,
): boolean {
  if (!question || question.kind !== 'match' || !question.pairs) return false;
  return question.pairs.every((_, i) => joins[i] !== undefined);
}

/**
 * Whether the question showing has been answered, whatever kind it is.
 *
 * A choice or a true-or-false is answered the moment an option is picked; a
 * match only once the last pair is placed. The screen reads this to decide
 * whether to reveal, and the reducer to decide whether to keep listening.
 */
export function isAnswered(
  question: QuizQuestion | undefined,
  picked: number | null,
  joins: Record<number, number>,
  typed: string | null = null,
): boolean {
  if (question?.kind === 'match') return matchDone(question, joins);
  if (question?.kind === 'word') return typed !== null;
  return picked !== null;
}

/**
 * Whether a typed answer is the one the question wanted.
 *
 * A thin wrapper, and it earns its place by being the only route: the reducer,
 * the screen's reveal and any future replay all have to agree about what
 * "right" was, and three call sites assembling the same three arguments is how
 * they stop agreeing. `others` defaults to nothing rather than being optional
 * in `lib/word.ts`, because the default belongs here — a question built
 * without rivals has none, which is different from a caller forgetting them.
 */
export function wordRight(question: QuizQuestion | undefined, typed: string): boolean {
  if (!question || question.kind !== 'word') return false;
  return judge(typed, question.full, question.others ?? []).ok;
}
