import { budget, hasPolicy, standing, tally } from '../lib/attend';
import type { Facts, Insight, Source } from './types';

/**
 * Absences used, against what the syllabus allows.
 *
 * Arithmetic on a rule the student typed off their own syllabus, which is why
 * it can be stated as flatly as it is. Nothing here is a judgement about
 * attending — a course that allows three absences is a course where three
 * absences are allowed, and the app's job is to say when the fourth stops
 * being free, not to have an opinion about the first.
 *
 * Reuses `lib/attend.ts` rather than recomputing. That file already knows what
 * an excused absence does and does not count toward, and a second
 * implementation would eventually disagree with the screen that shows it.
 */

/** Three marked meetings before a trajectory is a trajectory. */
const MINIMUM = 3;

export const attendance: Source = {
  id: 'attendance',
  minimum: MINIMUM,
  run(facts: Facts): Insight[] {
    const out: Insight[] = [];

    for (const course of facts.courses) {
      const policy = facts.attendPolicy[course.id];
      if (!hasPolicy(policy)) continue;

      const t = tally(facts.attendance, course.id);
      if (t.marked < MINIMUM) continue;

      const b = budget(policy, t);
      const where = standing(policy, t);
      // Clear with absences to spare is not news. The rule is silence unless
      // there is something the student does not already know.
      if (where === 'clear' && b.left > 1) continue;

      const marks = facts.attendance
        .filter((a) => a.courseId === course.id && a.mark !== 'present')
        .sort((a, b2) => (b2.date > a.date ? 1 : -1));

      const headline =
        where === 'over'
          ? `${course.code}: ${b.over} ${b.over === 1 ? 'absence' : 'absences'} past the ${policy.allowed} allowed, costing ${b.cost} points.`
          : b.left === 0
            ? `${course.code}: you have used all ${policy.allowed} allowed absences.`
            : `${course.code}: ${b.left} allowed ${b.left === 1 ? 'absence' : 'absences'} left of ${policy.allowed}.`;

      out.push({
        id: `attendance:${course.id}`,
        kind: where === 'over' ? 'projection' : 'observation',
        scope: 'course',
        courseId: course.id,
        headline,
        detail: policy.note
          ? `The syllabus says: “${policy.note}”`
          : `From ${t.marked} marked ${t.marked === 1 ? 'meeting' : 'meetings'}. Excused absences are not counted.`,
        evidence: marks.map((a) => ({
          says: `${course.code} · ${a.date} — ${a.mark}`,
          screen: 'calendar',
          id: a.date,
        })),
        // The rule is the student's own transcription, and the arithmetic on
        // it is exact. What is tentative is a course with barely any meetings
        // marked, where the count is right and the picture may not be.
        confidence: t.marked >= 6 ? 'firm' : 'tentative',
        sampleSize: t.marked,
        action: { label: course.code, screen: 'course' },
        // Above everything: this is points, already lost or one absence away.
        rank: where === 'over' ? 1 : 5,
      });
    }

    return out;
  },
};
