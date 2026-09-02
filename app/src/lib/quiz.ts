import { allCards } from '../data/catalog';
import type { Guide } from './types';
import type { QuizQuestion } from '../state/store';

/**
 * Ten multiple-choice questions drawn from the guide.
 *
 * The decoys are real answers to other questions in the same guide, which is
 * what makes the exercise worth doing — the wrong options are all plausible and
 * all true of something, so recognising the right one is the same discrimination
 * the exam asks for. Seeded so a run is reproducible but each new run differs.
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

  // Long answers are clipped so four options fit on a phone without scrolling
  // past the question.
  const clip = (text: string) =>
    text.length > 118 ? `${text.slice(0, 116).replace(/[ ,;—]+$/, '')}…` : text;

  return shuffled.slice(0, Math.min(10, shuffled.length)).map((card) => {
    const wrong: string[] = [];
    const seen = new Set<string>([card.a]);
    let guard = 0;
    while (wrong.length < 3 && guard < 400) {
      guard++;
      const candidate = all[Math.floor(rnd() * all.length)];
      if (seen.has(candidate.a)) continue;
      seen.add(candidate.a);
      wrong.push(candidate.a);
    }

    const opts = [
      ...wrong.map((a) => ({ text: clip(a), ok: false })),
      { text: clip(card.a), ok: true },
    ];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }

    return { q: card.q, unit: card.unit, full: card.a, opts };
  });
}
