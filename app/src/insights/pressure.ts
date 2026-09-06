import type { Facts, Insight, Source } from './types';

/**
 * What is late, and what is about to arrive all at once.
 *
 * Both of these came from `lib/insight.ts`, which this engine has absorbed.
 * The findings are the same and the shape is not: each now carries the actual
 * deadlines it counted, so "3 things are due inside three days" can be opened
 * to see which three. The old version printed "from 5 deadlines" and could not
 * say which five.
 */

/** One overdue deadline is a bad week. Two in a course is the course. */
const OVERDUE_FLOOR = 2;

/** Deadlines inside the window before a week is crowded rather than busy. */
const CROWD_FLOOR = 3;
const CROWD_HOURS = 72;

export const slipping: Source = {
  id: 'slipping',
  minimum: OVERDUE_FLOOR,
  run(facts: Facts): Insight[] {
    const late = facts.dated.filter((i) => i.isPast && !i.isToday && !facts.done[i.id]);
    const byCourse = new Map<string, typeof late>();
    for (const i of late) byCourse.set(i.c, [...(byCourse.get(i.c) ?? []), i]);

    return [...byCourse.entries()]
      .filter(([, rows]) => rows.length >= OVERDUE_FLOOR)
      .map(([courseId, rows]) => ({
        id: `slipping:${courseId}`,
        kind: 'observation' as const,
        scope: 'course' as const,
        courseId,
        headline: `${facts.codeOf(courseId)} has ${rows.length} things past their date.`,
        detail: `${rows[0].title} is the oldest, so it is the one most likely to be blocking the rest.`,
        evidence: rows.map((i) => ({
          says: `${facts.codeOf(i.c)} · ${i.title} — was due ${i.dueShort}`,
          screen: 'item' as const,
          id: i.id,
          at: i.date.getTime(),
        })),
        // Counted against today's date, which is not a sample — it is the
        // whole list. Nothing about it is going to shift.
        confidence: 'firm' as const,
        sampleSize: rows.length,
        action: { label: 'What is behind', screen: 'behind' as const },
        // Above everything except points already lost.
        rank: 2,
      }));
  },
};

export const crowded: Source = {
  id: 'crowded',
  minimum: CROWD_FLOOR,
  run(facts: Facts): Insight[] {
    const ahead = facts.dated
      .filter((i) => !i.isPast && !facts.done[i.id] && i.daysAway <= 21)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const anchor of ahead) {
      /*
       * At or after the anchor, never before it.
       *
       * Without the lower bound every earlier deadline also passes — a
       * negative difference is under seventy-two hours too — so the last item
       * in a well-spread term gathers the whole term behind it and reports a
       * cluster that is not there. Carried over from `lib/insight.ts` with
       * the bug it had already been fixed for.
       */
      const from = anchor.date.getTime();
      const window = ahead.filter((x) => {
        const gap = x.date.getTime() - from;
        return gap >= 0 && gap < CROWD_HOURS * 3_600_000;
      });
      if (window.length < CROWD_FLOOR) continue;

      const first = window[0];
      return [
        {
          id: `crowded:${first.id}`,
          kind: 'projection',
          scope: 'week',
          headline: `${window.length} things are due inside three days, from ${first.dueShort}.`,
          detail: `${first.title} is first. Starting it before the cluster arrives is the part of this you still control.`,
          evidence: window.map((i) => ({
            says: `${facts.codeOf(i.c)} · ${i.title} — ${i.dueShort}`,
            screen: 'item',
            id: i.id,
            at: i.date.getTime(),
          })),
          confidence: 'firm',
          sampleSize: window.length,
          action: { label: 'The week ahead', screen: 'ahead' },
          rank: 4,
        },
      ];
    }
    return [];
  },
};
