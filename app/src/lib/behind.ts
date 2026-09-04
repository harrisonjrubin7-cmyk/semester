/**
 * The screen for the week that went wrong.
 *
 * Every planner in existence assumes you are on track. When you are not, the
 * app turns into a wall of red you stop opening, and not opening it is what
 * makes the next week worse — so the moment a tool is most needed is the exact
 * moment it becomes unusable. Nobody builds for this. It is the difference
 * between something used for four years and something used for four weeks.
 *
 * ## Behind is measured, not felt
 *
 * "Behind" here is two numbers the app already has: how much has gone by
 * unticked, and whether the hours the next week asks for exceed the hours
 * there are. Both are countable, and stating them is the first useful thing
 * anybody can do — a bad week feels infinite and is usually eleven hours.
 *
 * ## It will not tell you what to drop
 *
 * That is the line, and it is not squeamishness. Whether to hand a paper in
 * late, take the zero, or ask for an extension depends on a late policy, a
 * professor, a grade, and a life the app cannot see, and the cost of getting
 * it wrong lands entirely on the student. So the app sorts by what it can
 * compute — what is gone, what fits, what does not — and hands the decision
 * over with the facts attached.
 *
 * What it *will* do is name the moves people forget exist. The single most
 * effective thing in a bad week is an email sent on Tuesday rather than an
 * apology on Friday, and no productivity app has ever suggested it.
 *
 * ## Nothing is hidden
 *
 * A triage screen that quietly dropped half the list would be the same wall of
 * red with better manners. Everything outstanding appears; what changes is the
 * order and what is said about each one.
 */

import type { DatedItem } from './types';
import { estimate, type Spent } from './pace';

/**
 * How far back a miss is still part of *this* week.
 *
 * A fortnight. Driving it against a term's worth of unticked sample data threw
 * up thirty-two "already gone" rows, the oldest forty-nine days past — which
 * is not triage, it is an archive, and a screen full of it is precisely the
 * wall of red this file exists to avoid. Older misses are counted and named in
 * the sentence, so nothing is hidden; what they are not is a list to work
 * through tonight.
 */
export const RECENT = 14;

/** Past this many hours short, a week is not a scheduling problem. */
export const DEEP = 6;

/** And past this many overdue, likewise. */
export const DEEP_OVERDUE = 3;

export interface Behind {
  /** Deadlines gone by inside the last fortnight — this week's problem. */
  overdue: number;
  /** Gone by longer ago than that. Counted, never listed. */
  long: number;
  /** Still ahead, inside the next seven days. */
  ahead: number;
  /** Hours the week ahead asks for, on your own timings. */
  needed: number;
  /** Hours there actually are, from your work windows. */
  there: number;
  /** How many pieces of work could not be timed at all. */
  unweighed: number;
  /** True when this is not a matter of a better plan. */
  deep: boolean;
}

export function howBehind(
  items: DatedItem[],
  done: Record<string, boolean>,
  spent: Spent[],
  hoursThere: number,
): Behind {
  const live = items.filter((i) => !done[i.id]);
  const overdue = live.filter((i) => i.daysAway < 0 && i.daysAway >= -RECENT);
  const long = live.filter((i) => i.daysAway < -RECENT);
  const soon = live.filter((i) => i.daysAway >= 0 && i.daysAway <= 7);

  let minutes = 0;
  let unweighed = 0;
  for (const i of [...overdue, ...soon]) {
    const e = estimate(spent, i.c, i.kind);
    if (e.minutes > 0) minutes += e.minutes;
    else unweighed += 1;
  }
  const needed = Math.round((minutes / 60) * 10) / 10;

  return {
    overdue: overdue.length,
    long: long.length,
    ahead: soon.length,
    needed,
    there: Math.round(hoursThere * 10) / 10,
    unweighed,
    deep: overdue.length >= DEEP_OVERDUE || needed - hoursThere >= DEEP,
  };
}

/**
 * The opening sentence, which has one job: make the week finite.
 *
 * A bad week feels infinite and is usually eleven hours. Saying the number is
 * the first useful thing that can happen, and it is a number the app has.
 * Never a reassurance — "you've got this" from a piece of software is the
 * thing that gets it closed.
 */
export function behindLine(b: Behind): string {
  if (b.overdue === 0 && b.ahead === 0 && b.long === 0) {
    return 'Nothing outstanding. This screen has no work to do.';
  }
  if (b.overdue === 0 && b.ahead === 0) {
    return `Nothing in the last fortnight or the next week. ${b.long} older ${b.long === 1 ? 'deadline is' : 'deadlines are'} still unticked, which is a tidying job rather than this one.`;
  }

  const bits: string[] = [];
  if (b.overdue > 0) {
    bits.push(`${b.overdue} ${b.overdue === 1 ? 'deadline has' : 'deadlines have'} gone by in the last fortnight`);
  }
  if (b.ahead > 0) bits.push(`${b.ahead} in the next seven days`);
  let head = `${bits.join(', ')}.`;
  // Named rather than silently excluded: the list below is deliberately the
  // recoverable window, and a count that vanished would be the app hiding
  // something.
  if (b.long > 0) {
    head += ` ${b.long} older than that ${b.long === 1 ? 'is' : 'are'} not in the list below.`;
  }

  if (b.needed <= 0) {
    return `${head} None of it is work this app has timed, so there is no hours figure to give.`;
  }
  const short = Math.round((b.needed - b.there) * 10) / 10;
  const hours =
    short > 0
      ? `That is about ${b.needed} hours of work against ${b.there} you have — ${short} short.`
      : `That is about ${b.needed} hours of work, and you have ${b.there}.`;
  return b.unweighed > 0
    ? `${head} ${hours} ${b.unweighed} more could not be timed.`
    : `${head} ${hours}`;
}

/** Where each piece of work stands, once the arithmetic is done. */
export type Standing = 'gone' | 'today' | 'fits' | 'tight';

export interface Step {
  id: string;
  title: string;
  courseId: string;
  where: Standing;
  /** Minutes, on your own timings. Null when it has never been timed. */
  minutes: number | null;
  daysAway: number;
  /** The percentage of the grade, where the syllabus stated one. */
  worth: number;
  /** What is true about it, in one clause. Never an instruction. */
  says: string;
}

function pointsOf(weight: string): number {
  const m = /(\d+(?:\.\d+)?)\s*%/.exec(weight);
  return m ? Number(m[1]) : 0;
}

/**
 * Everything outstanding, in the order a bad week wants it.
 *
 * Gone first, because what has already happened is the part somebody is
 * avoiding looking at and the part with a move attached that is not working
 * harder. Then today. Then what fits in the hours there are, biggest stakes
 * first. Then what does not.
 *
 * Nothing is dropped. A triage screen that quietly hid half the list would be
 * the same wall of red with better manners.
 */
export function triage(
  items: DatedItem[],
  done: Record<string, boolean>,
  spent: Spent[],
  hoursThere: number,
): Step[] {
  const live = items
    .filter((i) => !done[i.id] && i.daysAway <= 7 && i.daysAway >= -RECENT)
    .map((i) => {
      const e = estimate(spent, i.c, i.kind);
      const minutes = e.minutes > 0 ? e.minutes : null;
      const worth = pointsOf(i.weight);
      return { item: i, minutes, worth };
    });

  const gone = live.filter((x) => x.item.daysAway < 0);
  const today = live.filter((x) => x.item.daysAway === 0);
  const rest = live
    .filter((x) => x.item.daysAway > 0)
    // Stakes first among what is still ahead: in a week that will not fit, the
    // thing worth thirty per cent is the one an hour should go to.
    .sort((a, b) => b.worth - a.worth || a.item.daysAway - b.item.daysAway);

  const out: Step[] = [];
  const push = (x: (typeof live)[number], where: Standing, says: string) => {
    out.push({
      id: x.item.id,
      title: x.item.title,
      courseId: x.item.c,
      where,
      minutes: x.minutes,
      daysAway: x.item.daysAway,
      worth: x.worth,
      says,
    });
  };

  for (const x of gone.sort((a, b) => a.item.daysAway - b.item.daysAway)) {
    const late = -x.item.daysAway;
    push(
      x,
      'gone',
      `${late} ${late === 1 ? 'day' : 'days'} past. Working tonight cannot change that; asking might.`,
    );
  }
  for (const x of today) {
    push(x, 'today', x.worth > 0 ? `Due today, ${x.worth}% of the grade.` : 'Due today.');
  }

  // What is left, against the hours there are. Untimed work costs nothing it
  // can be held to, so it does not consume the budget.
  let left = hoursThere * 60;
  for (const x of rest) {
    const cost = x.minutes ?? 0;
    const fits = cost <= left;
    if (fits) left -= cost;
    const stake = x.worth > 0 ? `${x.worth}% of the grade` : 'no stated weight';
    push(
      x,
      fits ? 'fits' : 'tight',
      fits
        ? `In ${x.item.daysAway} ${x.item.daysAway === 1 ? 'day' : 'days'}, ${stake}.`
        : `In ${x.item.daysAway} ${x.item.daysAway === 1 ? 'day' : 'days'}, ${stake} — past the hours you have.`,
    );
  }
  return out;
}

/**
 * The moves that are not "work harder".
 *
 * These are the ones people forget exist under pressure, and the reason this
 * whole file is worth writing: an email sent on Tuesday is worth more than any
 * amount of rearranging on Friday, and no planner has ever said so.
 *
 * Offered, never done. Each is a thing the student decides to do, and the app
 * takes them to the screen that helps.
 */
export interface Move {
  id: string;
  what: string;
  why: string;
  /** The screen it opens. */
  screen: string;
}

export function moves(b: Behind): Move[] {
  const out: Move[] = [];
  if (b.overdue > 0) {
    out.push({
      id: 'write',
      what: 'Write to the professor',
      why: 'The single most effective thing in a week like this, and the one nobody does. A message on Tuesday is a different conversation from an apology on Friday. Late policies vary and most are more forgiving than people assume — but only if asked before the fact.',
      screen: 'mail',
    });
    out.push({
      id: 'hours',
      what: 'Go to office hours',
      why: 'Being a person rather than a name on a late list changes what is possible. It is also the fastest way to find out what a course actually does about work handed in late.',
      screen: 'courses',
    });
  }
  if (b.deep) {
    out.push({
      id: 'dates',
      what: 'Check the withdrawal dates',
      why: 'Not a suggestion to withdraw. These dates pass quietly and the decision gets made under time pressure with bad information, which is the worst way to make it. Knowing when they are costs nothing.',
      screen: 'registrar',
    });
    out.push({
      id: 'help',
      what: 'Find what the university offers',
      why: 'Advising, the writing studio, tutoring, counselling — all of it exists, all of it is paid for, and almost nobody uses it in the week it would help most.',
      screen: 'me',
    });
  }
  out.push({
    id: 'windows',
    what: 'Check the hours are right',
    why: 'The shortfall above is only as good as the hours you told the app you work in. If those are wrong, everything computed from them is wrong in the same direction.',
    screen: 'mine',
  });
  return out;
}

/**
 * What to say above the moves.
 *
 * Deliberately not encouragement. Software cannot know whether it will be all
 * right, and saying so is the fastest way to lose somebody who can already
 * tell the app has no idea what is happening to them.
 */
export function movesLine(b: Behind): string {
  if (b.overdue > 0) {
    return 'Things that are not working harder, and are usually worth more than working harder.';
  }
  return b.deep
    ? 'Worth doing before the week decides for you.'
    : 'Worth knowing about, whether or not this week needs them.';
}
