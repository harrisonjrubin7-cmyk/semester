/**
 * Mixing the cards up, and why the app has to explain itself to do it.
 *
 * A drill runs one course's cards, in urgency order — overdue first, then
 * unseen, then the known. That order is right and this does not change it.
 * What it changes is the *grouping*: instead of forty micro cards followed by
 * thirty political theory cards, they alternate.
 *
 * ## Why bother, when blocking feels better
 *
 * Because feeling better is the problem. Practising one kind of thing in a
 * block means the second card tells you what the first card was: you already
 * know it is a supply-and-demand question, so you never have to work out *what
 * kind of question this is* — which is the part an exam actually tests. Blocked
 * practice produces a smooth session and a worse exam. Mixed practice feels
 * clumsy, and the clumsiness is the work.
 *
 * This is the best-replicated result in the study-technique literature and it
 * is also the one nobody adopts, because it feels like getting worse. So the
 * app has to say why, in the place where it feels wrong, or somebody will turn
 * it off after one session and be right to.
 *
 * ## What it will not pretend
 *
 * With one course there is nothing to interleave, and the app says so rather
 * than offering a switch that does nothing. Interleaving fourteen cards from
 * one unit is not interleaving; it is the same cards in a different order.
 *
 * ## What it trades, and why that is the right trade
 *
 * Within a course, urgency is untouched: `dueFirst` put that course's most
 * overdue card first and it is still the first of that course you see.
 *
 * Across courses, spread wins over urgency, and that is deliberate. Somebody
 * who switched mixing on has already chosen spread over strict cross-course
 * urgency; that is what mixing *is*.
 *
 * Two attempts got the spreading wrong before this one, and both failures are
 * worth keeping written down because both looked correct:
 *
 * 1. *Take whichever course has the most urgent card waiting.* Produced
 *    `ababab` then `ccc` — a third of the run blocked, in exactly the case
 *    with most to mix, because one course happened to be entirely less
 *    overdue.
 * 2. *Take whichever course has the most cards left.* Fixed that, and starved
 *    the smallest course to the end of the run: with 100/100/100/20 cards,
 *    nothing from the fourth course appears until the others have burned down
 *    to twenty, which is well past the end of any real session. The app said
 *    "cards from 4 courses" and showed three.
 *
 * What it does instead is place each course's cards where they would fall if
 * that course were spread evenly across the whole run: the k-th card of a
 * course with n of them belongs at position (k + ½)·total/n. A course holding
 * a fifth of the deck comes up every fifth card or so, whatever the other
 * courses are doing. Ties go to the more urgent card, and the run never puts
 * two of one course together while another has cards left.
 */

/** Whether mixing is even possible with what is in front of somebody. */
export function worthMixing<T>(items: T[], groupOf: (item: T) => string): boolean {
  const groups = new Set(items.map(groupOf));
  return groups.size > 1 && items.length > 3;
}

/**
 * The same cards, ordered so consecutive ones come from different groups.
 *
 * Stable: the relative order *within* a group is untouched, so `dueFirst`'s
 * ranking survives — a group's most overdue card is still the first of that
 * group to appear. Nothing is dropped and nothing is duplicated.
 */
export function interleave<T>(items: T[], groupOf: (item: T) => string): T[] {
  if (items.length < 2) return [...items];

  // One queue per group, each keeping the order it arrived in.
  const queues = new Map<string, T[]>();
  for (const item of items) {
    const g = groupOf(item);
    const q = queues.get(g);
    if (q) q.push(item);
    else queues.set(g, [item]);
  }
  if (queues.size < 2) return [...items];

  // Where each group's head sat in the original ordering. Lower is more
  // urgent, because that is what `dueFirst` produced.
  const rank = new Map<T, number>();
  items.forEach((item, i) => rank.set(item, i));

  const total = items.length;
  // How many each group started with, and how many of them have gone. Both are
  // needed to say where a group's *next* card belongs in an even spread.
  const size = new Map<string, number>();
  for (const [g, q] of queues) size.set(g, q.length);
  const done = new Map<string, number>();

  const out: T[] = [];
  let last = '';
  while (out.length < total) {
    let best: string | null = null;
    let bestSlot = Infinity;
    let bestRank = Infinity;
    // The tail, where only the group that just went has anything left. Running
    // those consecutively is the only alternative to dropping them.
    let fallback: string | null = null;

    // The very first card goes by urgency alone — every group's ideal slot is
    // the same at the start, so the tiebreak decides it, and opening a session
    // on the most overdue thing you have costs the spread nothing.
    const opening = out.length === 0;

    for (const [g, q] of queues) {
      if (q.length === 0) continue;
      fallback ??= g;
      if (g === last) continue;
      const r = rank.get(q[0]) ?? 0;
      // Where this group's next card belongs if the group were spread evenly
      // across the whole run. Whichever group is furthest overdue for a turn
      // by that measure goes next, so a small course is not held back until
      // the big ones have burned down to its size.
      const slot = opening ? 0 : ((done.get(g) ?? 0) + 0.5) * (total / (size.get(g) as number));
      if (slot < bestSlot || (slot === bestSlot && r < bestRank)) {
        best = g;
        bestSlot = slot;
        bestRank = r;
      }
    }

    const take = best ?? fallback;
    if (take === null) break;
    const q = queues.get(take);
    if (!q || q.length === 0) break;
    out.push(q.shift() as T);
    done.set(take, (done.get(take) ?? 0) + 1);
    last = take;
  }
  return out;
}

/** The longest stretch of one group, for a test and for the settings line. */
export function longestRun<T>(items: T[], groupOf: (item: T) => string): number {
  let best = 0;
  let run = 0;
  let last = '';
  for (const item of items) {
    const g = groupOf(item);
    run = g === last ? run + 1 : 1;
    last = g;
    if (run > best) best = run;
  }
  return best;
}

/** How many distinct groups are in play. */
export function groupCount<T>(items: T[], groupOf: (item: T) => string): number {
  return new Set(items.map(groupOf)).size;
}

/**
 * What the app says where the mixing feels wrong.
 *
 * Named rather than sold, and honest that it is harder. "Mixing makes this
 * feel worse and work better" is a claim somebody can weigh; "optimised
 * practice" is not.
 */
export function mixLine<T>(items: T[], groupOf: (item: T) => string, on: boolean): string {
  const groups = groupCount(items, groupOf);
  if (groups < 2) {
    return 'Only one course in this run, so there is nothing to mix.';
  }
  if (!on) {
    return `${groups} courses, one after another. Mixing them makes a session feel clumsier and an exam easier — you have to work out what kind of question it is, which is the part being tested.`;
  }
  return `Cards from ${groups} courses, alternating. It will feel harder than taking one course at a time. That is the point, and it is the most reliably replicated result in the whole of study technique.`;
}
