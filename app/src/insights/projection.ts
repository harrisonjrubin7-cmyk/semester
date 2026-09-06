import { key } from '../lib/grades';
import { standing } from '../lib/grades';
import type { Facts, Insight, Source } from './types';

/**
 * Where the grade stands, and how much of it is still unknown.
 *
 * The number every student wants and the one most easily made dishonest. A
 * projection from two graded components out of eight is a real number about a
 * quarter of a course, and printing it without that qualification is how an
 * app tells somebody they are fine in October.
 *
 * So the ungraded share is in the headline rather than under a control, and
 * the projection is a range rather than a point: what is banked is a fact,
 * what is left is not.
 *
 * Reuses `lib/grades.ts`, including its drop handling. A second implementation
 * of "strike the lowest two quizzes" would eventually disagree with the Grades
 * screen, and the two numbers would both be on the same phone.
 */

/** Two graded components. One is a data point, not a standing. */
const MINIMUM = 2;

export const projection: Source = {
  id: 'projection',
  minimum: MINIMUM,
  run(facts: Facts): Insight[] {
    const out: Insight[] = [];

    for (const course of facts.courses) {
      const s = standing(course, facts.scores, {
        pieces: facts.pieces,
        drops: facts.drops,
      });

      const graded = s.rows.filter((r) => r.score !== null);
      if (graded.length < MINIMUM) continue;
      if (s.current === null) continue;

      /*
       * Two numbers, and the gap between them is the honesty.
       *
       * The floor assumes nothing more is earned; the ceiling assumes
       * everything remaining is full marks. Neither will happen, and quoting
       * only the middle one hides how little is decided.
       */
      const floor = Math.round(s.earned - s.pointsOff);
      const ceiling = Math.round(s.earned + s.remaining + s.extraCredit - s.pointsOff);
      const ungraded = Math.round(s.remaining);

      out.push({
        id: `projection:${course.id}`,
        kind: 'projection',
        scope: 'course',
        courseId: course.id,
        headline: `${course.code}: ${Math.round(s.current)}% across ${graded.length} of ${s.rows.length} graded components.`,
        detail:
          ungraded > 0
            ? `${ungraded}% of the grade is still ungraded, so the finish is anywhere from ${floor}% to ${ceiling}%.` +
              (s.incomplete ? ' The weights in the syllabus do not add to 100, so these are indicative.' : '') +
              (s.pointsOff > 0 ? ` ${s.pointsOff} points are already off for absences.` : '')
            : `Everything is graded. ${s.incomplete ? 'The weights do not add to 100, so this is indicative.' : ''}`,
        evidence: graded.map((r, i) => ({
          says: `${course.code} · ${r.what} — ${facts.scores[key(course.id, s.rows.indexOf(r))] ?? '—'} at ${r.weight}%`,
          screen: 'grades',
          id: `${course.id}:${i}`,
        })),
        // Firm once most of the course is decided; tentative while most of it
        // is not, however many components have come back.
        confidence: ungraded <= 40 && !s.incomplete ? 'firm' : 'tentative',
        sampleSize: graded.length,
        action: { label: 'Grades', screen: 'grades' },
        rank: 3,
      });
    }

    return out;
  },
};
