import { allCards } from '../data/catalog';
import type { Guide } from './types';
import type { QuizQuestion } from '../state/store';

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

/**
 * Up to ten multiple-choice questions drawn from the guide.
 *
 * The decoys are real answers to other questions in the same guide, which is
 * what makes the exercise worth doing — the wrong options are all plausible and
 * all true of something, so recognising the right one is the same
 * discrimination the exam asks for. Seeded so a run is reproducible but each
 * new run differs.
 *
 * "Up to", because a question that cannot find three different decoys is
 * dropped rather than asked with two options.
 */
export function buildQuiz(guide: Guide, seed: number): QuizQuestion[] {
  const all = allCards(guide);
  if (all.length === 0) return [];

  let s = (seed * 9301) % 233280 || 1;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const shuffled = [...all];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const out: QuizQuestion[] = [];

  for (const card of shuffled.slice(0, Math.min(10, shuffled.length))) {
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
    if (wrong.length < 3) continue;

    const opts = [...wrong.map((a) => ({ text: a, ok: false })), { text: right, ok: true }];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }

    out.push({ q: card.q, unit: card.unit, full: card.a, opts });
  }

  return out;
}
