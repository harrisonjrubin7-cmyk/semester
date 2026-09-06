import { caseOf } from '../lib/sure';
import type { Facts, Insight, Source } from './types';

/**
 * Where you are sure and wrong.
 *
 * The single most valuable signal in the dataset, and the reason the app asks
 * how sure you were before it shows the answer. Everything else in a study app
 * finds gaps — things you have not learned yet, which you already know about.
 * This finds beliefs: the card you answer confidently and get wrong, which no
 * amount of re-reading will fix because you are not looking for it.
 *
 * Reported per topic rather than per card. One confidently wrong card is a
 * slip; four in the same unit is a misunderstanding of that unit, and the unit
 * is the thing to drill.
 */

/** Eight answers before a topic can be said to have a pattern in it. */
const MINIMUM = 8;

export const confident: Source = {
  id: 'confident',
  minimum: MINIMUM,
  run(facts: Facts): Insight[] {
    if (facts.answers.length < MINIMUM) return [];

    /** Answers grouped by the unit their card belongs to. */
    const byUnit = new Map<string, { courseId: string; unit: string; answers: typeof facts.answers }>();
    for (const a of facts.answers) {
      const unit = facts.unitOf(a.courseId, a.key);
      if (!unit) continue;
      const k = `${a.courseId}::${unit}`;
      const got = byUnit.get(k) ?? { courseId: a.courseId, unit, answers: [] };
      got.answers.push(a);
      byUnit.set(k, got);
    }

    const out: Insight[] = [];
    for (const [, group] of byUnit) {
      const cases = group.answers.map(caseOf);
      const sure = cases.filter((c) => c === 'wrongSure').length;
      const others = cases.length - sure;

      /*
       * More confidently wrong than everything else put together.
       *
       * A high bar on purpose. Being wrong is ordinary and being wrong while
       * sure is the finding, so the threshold is not "some" — it is that this
       * unit's answers are mostly that.
       */
      if (sure < 3 || sure <= others) continue;
      if (group.answers.length < 4) continue;

      const wrong = group.answers.filter((a) => caseOf(a) === 'wrongSure');
      out.push({
        id: `confident:${group.courseId}:${group.unit}`,
        kind: 'observation',
        scope: 'course',
        courseId: group.courseId,
        headline: `In ${group.unit}, you were sure and wrong ${sure} times out of ${group.answers.length}.`,
        detail:
          'That is a belief rather than a gap: re-reading does not find it, because you are not looking for it. The drill below shows these cards first.',
        evidence: wrong.map((a) => ({
          says: `${facts.codeOf(a.courseId)} · ${group.unit} — answered confidently, got it wrong`,
          screen: 'drill',
          id: a.key,
          at: a.at,
        })),
        confidence: sure >= 5 ? 'firm' : 'tentative',
        sampleSize: group.answers.length,
        action: { label: `Drill ${group.unit}`, screen: 'drill' },
        // Above calibration: a wrong belief costs marks on the day, and an
        // estimate that is out costs a weekend.
        rank: 10,
      });
    }

    return out.sort((a, b) => b.sampleSize - a.sampleSize).slice(0, 3);
  },
};
