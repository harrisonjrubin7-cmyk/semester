/**
 * Where you stand — counted, not felt.
 *
 * The Progress screen's first tab used to be three facts and a chart: four
 * numbers across the top, a bar per course, and the medians from `pace.ts`.
 * Every one of them was true and none of them answered the question somebody
 * opens that tab to ask, which is *am I keeping up*. Four courses and eleven
 * credits is the shape of the semester, not a report on it, and it reads the
 * same in week one as in week fourteen.
 *
 * What follows is the arithmetic behind an answer. It is deliberately small
 * and deliberately here rather than in the screen, for the reason the rest of
 * this codebase gives: a number rendered inline is a number nothing can test
 * and nothing else can quote, and the app has already been bitten by two
 * screens disagreeing about one fact.
 *
 * ## Three rules it keeps
 *
 * **Only this term's deadlines count.** `state.done` is keyed by item id and
 * survives the course it belonged to — removing a course leaves its ticks
 * behind, by design, so re-importing the syllabus finds them again. Counting
 * the map's own length therefore produced a "Done" that could exceed the
 * number of deadlines in the app, and did, for anybody who had ever removed a
 * course. Everything here is counted against the catalogue in front of you.
 *
 * **Nothing is a score.** There is no streak, no percentage of you, and no
 * comparison with anybody. Late is late because a missed deadline is worth
 * naming, not to shame anyone with a red number.
 *
 * **A figure that rests on nothing is not shown.** `through` is null until the
 * deadlines describe a span, and the caller drops the row rather than drawing
 * an empty bar at zero.
 */

import { creditHoursOr0 } from './credits';
import { split, type DoneMap } from './standing';
import type { DatedItem, Screen } from './types';

/**
 * How far through the term the deadlines say we are, 0–1, or null.
 *
 * The app has no term start and end — the one place a term's shape is written
 * down is the spread of its own deadlines. First to last is a proxy and is
 * named as one wherever it is shown ("of the term's deadlines"), rather than
 * claimed as a calendar.
 *
 * Lived in `softtop.ts` as a private function, which meant the soft shell's
 * header and this screen would have been two answers to one question the
 * moment either was touched.
 */
export function termProgress(items: DatedItem[], now: Date): number | null {
  const times = items.map((i) => i.date.getTime()).filter((t) => !Number.isNaN(t));
  if (times.length < 2) return null;
  const first = Math.min(...times);
  const last = Math.max(...times);
  if (last <= first) return null;
  return Math.max(0, Math.min(1, (now.getTime() - first) / (last - first)));
}

/** The next seven days, as a fraction you can act on. */
export interface Week {
  /** Deadlines dated inside the window, ticked or not. */
  due: number;
  /** How many of those are already ticked. */
  done: number;
}

/**
 * What the coming week is actually carrying.
 *
 * Today counts. A deadline due at 11:59 tonight is this week's work however
 * many hours are left of it, and dropping it because its date has technically
 * arrived is how a planner tells you a quiet week before the evening you lose.
 */
export function weekAhead(items: DatedItem[], done: DoneMap, days = 7): Week {
  const inside = items.filter((i) => i.daysAway >= 0 && i.daysAway < days);
  return {
    due: inside.length,
    done: inside.filter((i) => done[i.id]).length,
  };
}

/** Everything the headline says, in one object so nothing is computed twice. */
export interface Where {
  courses: number;
  /** Summed from the syllabi that state credits. Zero means none of them did. */
  credits: number;
  /** Still to come and not ticked. The number that means "left to do". */
  ahead: number;
  /** Ticked, whenever it was due — this term's, not every tick ever made. */
  done: number;
  /** Past its date and still not ticked. */
  late: number;
  /** Every deadline in the catalogue. */
  total: number;
  /** 0–1 through the term's own span, or null when it has no span yet. */
  through: number | null;
  week: Week;
}

export function whereYouStand(input: {
  courses: { credits?: string }[];
  items: DatedItem[];
  done: DoneMap;
  now: Date;
}): Where {
  const { courses, items, done, now } = input;
  const parts = split(items, done);
  // Ahead-and-ticked is neither ahead nor late: it is done early, and the
  // person who did it should see it in the column that says so.
  const ahead = parts.ahead.filter((i) => !done[i.id]).length;
  return {
    courses: courses.length,
    credits: courses.reduce((sum, c) => sum + creditHoursOr0(c.credits), 0),
    ahead,
    done: parts.done.length,
    late: parts.overdue.length,
    total: items.length,
    through: termProgress(items, now),
    week: weekAhead(items, done),
  };
}

/**
 * "Three of seven done" — or the honest sentence when there is nothing due.
 *
 * Here rather than in the screen because it is the one line most likely to be
 * copied into a brief or a notification, and a second copy would drift.
 */
export function weekLine(week: Week): string {
  if (week.due === 0) return 'Nothing falls in the next seven days.';
  if (week.done === week.due)
    return week.due === 1 ? 'The one thing due this week is done.' : `All ${week.due} done.`;
  return `${week.done} of ${week.due} done.`;
}

/**
 * ## The three things added when this tab stopped being a report
 *
 * Everything above answers *where you stand*, which is what a progress screen
 * is for and is not what somebody opening one at eleven at night is going to
 * do about it. What follows turns the same numbers into a sentence, a shape
 * and a short list of doors — no new arithmetic about the student, and nothing
 * that is not already counted above.
 */

/**
 * The whole standing in one sentence.
 *
 * The tab opened on four numbers in a row and expected the reader to add them
 * up: 40 ahead, 8 done, 11 credits, 4 courses is four true facts and no
 * answer. Late first, because a missed deadline outranks everything else on
 * the screen, and the week second, because that is the span somebody can
 * still do something about.
 *
 * No praise and no scolding either way — "2 late, and 5 due in the next seven
 * days" is the whole sentence. The app is not the person's parent.
 */
export function standLine(where: Where): string {
  const { late, week, ahead, total } = where;
  // A syllabus can arrive with no dates on it at all — a reading list, or one
  // the parser could get nothing out of. "Every deadline is ticked" would be
  // technically true of nothing and read as a lie.
  if (total === 0) return 'No dated deadlines have come off your syllabi yet.';
  // "1 thing is" and "2 things are" — the verb has to move with the number, and
  // a sentence that says "1 things" is the app looking as though nobody read it.
  const past = late === 1 ? '1 thing is past its date' : `${late} things are past their date`;

  if (late > 0 && week.due > 0)
    return `${past}, and ${week.due} more ${week.due === 1 ? 'falls' : 'fall'} inside seven days.`;
  if (late > 0) return `${past}. Nothing else falls in the next seven days.`;
  if (week.due > 0 && week.done === week.due)
    return week.due === 1
      ? 'The one thing due this week is done.'
      : `All ${week.due} of this week's deadlines are done.`;
  if (week.due > 0) {
    const left = week.due - week.done;
    return `${left} of the ${week.due} due inside seven days ${left === 1 ? 'is' : 'are'} still to do.`;
  }
  if (ahead > 0)
    return `Nothing in the next seven days. ${ahead} still ahead of you this term.`;
  return 'Every deadline on your syllabi is ticked.';
}

/** One day of the coming week, counted. */
export interface Day {
  date: Date;
  /** Sunday is 0, as `DOW` and `DOW_INITIALS` are indexed. */
  dow: number;
  /** Deadlines dated that day, ticked or not. */
  due: number;
  /** How many of those are ticked. */
  done: number;
  /** True for the day the clock is on, which is drawn differently. */
  today: boolean;
}

/**
 * The next seven days, day by day, so the week has a shape and not a share.
 *
 * A single bar reading "2 of 5 done" is the same week whether the five are
 * spread across seven days or all land on Thursday, and those are not the
 * same week — the second is the one that ruins somebody's Wednesday night.
 * The bar could not say which, because a fraction has no room for *when*.
 *
 * Today is the first column, not Sunday. This is the seven days in front of
 * you rather than a calendar week: the question is what is coming, and half a
 * calendar week is usually behind you.
 */
export function weekShape(items: DatedItem[], done: DoneMap, now: Date, days = 7): Day[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const on = items.filter(
      (item) =>
        item.date.getFullYear() === date.getFullYear() &&
        item.date.getMonth() === date.getMonth() &&
        item.date.getDate() === date.getDate(),
    );
    return {
      date,
      dow: date.getDay(),
      due: on.length,
      done: on.filter((item) => done[item.id]).length,
      today: i === 0,
    };
  });
}

/**
 * A deadline's title, short enough to sit on a button.
 *
 * "Reflection #2 — Are elite athletes super-humans?" is a fair title for a
 * row and half a phone screen for a button, and a mid-word ellipsis is the
 * app looking as though nobody read it. Real syllabus titles carry their own
 * break — an em dash, a colon, a bracket — so the first clause is taken where
 * there is one and it is long enough to name the thing, and the words are cut
 * on a space otherwise.
 */
export function shortly(title: string, most = 30): string {
  const clause = /^(.{6,}?)\s+[—–-]\s|^([^:(]{6,}?):\s/.exec(title);
  const head = (clause?.[1] ?? clause?.[2] ?? title).trim();
  if (head.length <= most) return head;
  const cut = head.slice(0, most);
  const space = cut.lastIndexOf(' ');
  return `${(space > most / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * A door worth offering right now, with the count that makes it worth pressing.
 *
 * Not advice, and deliberately not a second insights engine: `src/insights/`
 * notices things and explains them, and every one of its findings is a
 * paragraph. These are three buttons, each naming a number the screen is
 * already showing and going to the screen that number belongs to. The
 * difference is what somebody wants at each end of the same screen — the top
 * of a progress tab is where you decide what to do next, and reading a
 * paragraph is not that.
 */
export interface Door {
  id: 'late' | 'cards' | 'next' | 'week';
  /** The words on the button, with the count in them. */
  label: string;
  /** The screen it opens. */
  screen: Screen;
  /** The deadline to open, where the door is one particular thing. */
  item?: string;
}

/**
 * Up to three doors, in the order the day actually asks for them.
 *
 * Late first for the reason `standLine` puts it first. Cards second because
 * they are the one thing on this screen that can be done in the ten minutes
 * somebody has while reading it. The next deadline third, because opening it
 * is how you find out what it needs.
 *
 * `cards` is what has genuinely come round — `comeRound` in `lib/review.ts`,
 * never `dueCount`, which calls a card nobody has ever met "due" and would
 * offer a fresh account a door reading "Drill 325 cards".
 */
export function doors(input: {
  where: Where;
  cards: number;
  /** The soonest unticked deadline still ahead, if there is one. */
  next: DatedItem | null;
}): Door[] {
  const { where, cards, next } = input;
  const out: Door[] = [];
  if (where.late > 0)
    out.push({ id: 'late', label: `${where.late} late`, screen: 'behind' });
  if (cards > 0)
    out.push({ id: 'cards', label: `Drill ${cards} ${cards === 1 ? 'card' : 'cards'}`, screen: 'study' });
  if (next)
    out.push({ id: 'next', label: `Start ${shortly(next.title)}`, screen: 'item', item: next.id });
  // Nothing late, nothing drilled, nothing dated — the week screen is still
  // worth an offer, because it is where the hours are. One door beats none.
  if (out.length === 0 && where.ahead > 0)
    out.push({ id: 'week', label: 'Plan the week', screen: 'ahead' });
  return out.slice(0, 3);
}

/**
 * The soonest thing still to do, which is what "next" means to a person.
 *
 * Ticked things are skipped and late things are not — something a week
 * overdue is not "next", it is a door of its own above.
 */
export function nextUp(items: DatedItem[], done: DoneMap): DatedItem | null {
  return items.find((i) => !i.isPast && !done[i.id]) ?? null;
}
