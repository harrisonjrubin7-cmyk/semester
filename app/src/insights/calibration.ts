import { calibrate } from '../lib/worth';
import type { Facts, Insight, Source } from './types';

/**
 * What you think something takes, against what it takes.
 *
 * The most actionable number in the dataset, because it is the one that
 * silently ruins a week: an estimate that is consistently two-thirds of the
 * truth turns a plan that fits into a plan that does not, and nothing on any
 * screen would say so.
 *
 * It is stated as a ratio and a pair of times, never as a verdict. "You
 * estimate 2 hours. You take about 3 hours 20" is a fact about ten records.
 * "You underestimate" is a claim about a person.
 */

/**
 * The ratio itself comes from `lib/worth.ts`, and that is the point.
 *
 * `calibrate()` is not a reporting function — the bias it returns is applied
 * to every estimate the app shows, so it is already the app's official answer
 * to "how far out are your guesses". Computing a second median here produced a
 * second answer: for a while the Worked screen said "You estimate 1 hour 30,
 * you take about 2 hours 35" from this file and "a ratio of 1.72" from that
 * one, forty pixels apart. Same data, same fact, two roundings, and the reader
 * left to work out which to believe.
 *
 * So this reads the ratio and adds what a ratio cannot carry: the two times in
 * words, and the reports behind them as evidence you can open.
 */

/** Five is where a median stops being one person's bad Tuesday. */
const MINIMUM = 5;

/** The last of them, because a term changes how somebody works. */
const WINDOW = 10;

const hhmm = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} minutes`;
  if (m === 0) return `${h} ${h === 1 ? 'hour' : 'hours'}`;
  return `${h} ${h === 1 ? 'hour' : 'hours'} ${m}`;
};

const median = (ns: number[]): number => {
  const s = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const calibration: Source = {
  id: 'calibration',
  minimum: MINIMUM,
  run(facts: Facts): Insight[] {
    // Only reports that carried a guess. A report made without one measures
    // nothing about estimating — see `Spent.guess`.
    const guessed = facts.spent
      .filter((s) => typeof s.guess === 'number' && s.guess > 0 && s.minutes > 0)
      .sort((a, b) => b.at - a.at)
      .slice(0, WINDOW);

    if (guessed.length < MINIMUM) return [];

    const c = calibrate(
      guessed.map((s) => ({ guess: s.guess as number, minutes: s.minutes, at: s.at })),
    );
    if (!c) return [];
    const ratio = c.ratio;
    const guess = median(guessed.map((s) => s.guess as number));
    const took = median(guessed.map((s) => s.minutes));

    /*
     * Within a fifth either way is not a finding.
     *
     * Somebody whose estimates land inside 20% is estimating well, and telling
     * them so is a compliment rather than an insight. Saying nothing is the
     * right output — this is the silence rule, applied to a result rather than
     * to a sample size.
     */
    if (ratio > 0.8 && ratio < 1.2) return [];

    const over = ratio > 1;
    const by = Math.round(Math.abs(ratio - 1) * 100);

    return [
      {
        id: 'calibration',
        kind: 'pattern',
        scope: 'term',
        headline: `You estimate ${hhmm(guess)}. You take about ${hhmm(took)}.`,
        detail: over
          ? `Across your last ${guessed.length} timed pieces of work, the median came in ${by}% over the estimate. The app's derived start dates use its own median rather than yours, so they do not already account for this.`
          : `Across your last ${guessed.length} timed pieces of work, the median came in ${by}% under the estimate.`,
        evidence: guessed.map((s) => ({
          says: `${facts.codeOf(s.courseId)} · ${s.kind} — guessed ${hhmm(s.guess as number)}, took ${hhmm(s.minutes)}`,
          screen: 'item',
          id: s.id,
          at: s.at,
        })),
        // Firm only when the sample is full and the miss is not marginal.
        confidence: guessed.length >= 8 && by >= 30 ? 'firm' : 'tentative',
        sampleSize: guessed.length,
        action: { label: 'Where your hours go', screen: 'work' },
        rank: 20,
      },
    ];
  },
};
