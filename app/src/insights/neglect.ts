import type { Facts, Insight, Source } from './types';

/**
 * A course nothing has touched, and a course the papers keep coming back low in.
 *
 * Both carried over from `lib/insight.ts`, which this engine has absorbed, and
 * both keep the reasoning that made them fair.
 */

/** Days of no contact at all before a course counts as untouched. */
const COLD_DAYS = 14;
const DAY = 86_400_000;

/** Papers sat in a course before an average is an average. */
const PAPER_FLOOR = 2;

/** Below this, a paper average is worth naming. */
const WEAK_PCT = 70;

const median = (ns: number[]): number => {
  const s = [...ns].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const untouched: Source = {
  id: 'untouched',
  minimum: 1,
  run(facts: Facts): Insight[] {
    /*
     * The comparison is what makes this fair.
     *
     * Somebody who has not opened the app for a fortnight is not neglecting
     * one course, they are having a fortnight, and telling them off for it
     * would be both wrong and unkind. This only speaks when other courses
     * were getting attention over the same stretch.
     */
    if (facts.courses.length < 2) return [];
    const since = facts.now.getTime() - COLD_DAYS * DAY;
    const warm = new Set<string>();

    for (const s of facts.spent) if (s.at >= since) warm.add(s.courseId);
    for (const s of facts.sittings) if (s.at >= since) warm.add(s.courseId);
    for (const a of facts.answers) if (a.at >= since) warm.add(a.courseId);
    // A card key is `courseId:hash`, so the course is the part before the
    // colon. See `lib/review.ts` — the id is derived, never stored.
    for (const [key, r] of Object.entries(facts.reviews)) {
      if (r.seen >= since) warm.add(key.slice(0, key.indexOf(':')));
    }

    if (warm.size === 0) return [];

    const cold = facts.courses
      .filter((c) => !warm.has(c.id))
      // Only worth saying about a course that still has something coming. A
      // finished course being quiet is a course being finished.
      .filter((c) => facts.dated.some((i) => i.c === c.id && !i.isPast && !facts.done[i.id]))
      .map((c) => ({
        course: c,
        coming: facts.dated.filter((i) => i.c === c.id && !i.isPast && !facts.done[i.id]),
      }));

    if (cold.length === 0) return [];

    /*
     * One insight, however many courses are cold.
     *
     * The first version returned one per course, and on an account where the
     * work had all gone into one subject that produced three rows saying the
     * same sentence with a different code in it. Three near-identical cards is
     * how a report teaches somebody to scroll past it — and the finding is
     * about where the attention went, which is one fact about the term rather
     * than three facts about three courses.
     */
    const codes = cold.map((c) => facts.codeOf(c.course.id));
    const coming = cold.flatMap((c) => c.coming);

    return [
      {
        id: 'untouched',
        kind: 'observation' as const,
        scope: 'term' as const,
        headline:
          cold.length === 1
            ? `${codes[0]} has had nothing for a fortnight.`
            : `${codes.slice(0, -1).join(', ')} and ${codes.at(-1)} have had nothing for a fortnight.`,
        detail: `${warm.size} of your ${facts.courses.length} courses ${warm.size === 1 ? 'was' : 'were'} worked on over the same stretch, and ${coming.length} ${coming.length === 1 ? 'thing is' : 'things are'} still to come in the ${cold.length === 1 ? 'other one' : 'others'}.`,
        /*
         * The evidence is what is still coming, not the absence.
         *
         * You cannot show somebody a list of the work they did not do. What
         * makes this checkable is the other half — the deadlines that make the
         * silence matter — and a course with none of those does not produce
         * this insight at all.
         */
        evidence: coming
          .sort((x, y) => x.date.getTime() - y.date.getTime())
          .slice(0, 12)
          .map((i) => ({
            says: `${facts.codeOf(i.c)} · ${i.title} — ${i.dueShort}`,
            screen: 'item' as const,
            id: i.id,
            at: i.date.getTime(),
          })),
        confidence: warm.size >= 2 ? ('firm' as const) : ('tentative' as const),
        sampleSize: coming.length,
        action: { label: 'Your courses', screen: 'study' as const },
        rank: 12,
      },
    ];
  },
};

export const weakPapers: Source = {
  id: 'weak-papers',
  minimum: PAPER_FLOOR,
  run(facts: Facts): Insight[] {
    const byCourse = new Map<string, typeof facts.sittings>();
    for (const s of facts.sittings) byCourse.set(s.courseId, [...(byCourse.get(s.courseId) ?? []), s]);

    return [...byCourse.entries()]
      .filter(([, rows]) => rows.length >= PAPER_FLOOR)
      .map(([courseId, rows]) => ({ courseId, rows, avg: Math.round(median(rows.map((r) => r.pct))) }))
      .filter((x) => x.avg < WEAK_PCT)
      .map((x) => ({
        id: `weak-papers:${x.courseId}`,
        kind: 'observation' as const,
        scope: 'course' as const,
        courseId: x.courseId,
        headline: `${facts.codeOf(x.courseId)} papers sit around ${x.avg}%.`,
        /*
         * Marks the student set themselves, against their own questions.
         *
         * The only finding drawn from marks, and there is no comparison with
         * anybody — which is the whole reason it is safe to state as flatly
         * as it is.
         */
        detail:
          'These are papers you sat against your own questions. The misses are already a deck, which is a better use of an hour than re-reading the unit.',
        evidence: x.rows
          .sort((a, b) => b.at - a.at)
          .map((s) => ({
            says: `${facts.codeOf(s.courseId)} · ${s.title} — ${s.got}/${s.outOf} (${Math.round(s.pct)}%)`,
            screen: 'exam' as const,
            id: s.id,
            at: s.at,
          })),
        confidence: x.rows.length >= 4 ? ('firm' as const) : ('tentative' as const),
        sampleSize: x.rows.length,
        action: { label: 'Drill the misses', screen: 'drill' as const },
        rank: 8,
      }));
  },
};
