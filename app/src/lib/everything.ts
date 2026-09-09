import type { Catalog } from '../data/catalog';
import type { State } from '../state/shape';
import { DESTINATIONS, TASKS, taskLabel, type Destination, type TaskTag } from './nav';
import type { Screen } from './types';
import { dayOf } from './date';

/**
 * What the Everything directory knows, with no React in it.
 *
 * Everything on this screen is derived: the rows come from `DESTINATIONS`, the
 * task sections from the `taskTags` on those rows, the shortcut list from
 * `SHORTCUTS`, and the counts from the store. Nothing is written twice, so a
 * screen added to the registry appears here and a screen deleted from it
 * disappears, which is the whole point of the screen and is what the tests at
 * the bottom of `everything.test.ts` check.
 */

/** How long a screen can go unopened before it counts as untried again. */
export const STALE_DAYS = 60;

const DAY = 86_400_000;

/**
 * What this screen is holding, in three or four words.
 *
 * Only where the number is a real answer to "is there anything in here". A
 * count of the things a screen *shows* rather than the things it *holds*
 * would be worse than nothing: "12 deadlines" beside the calendar reads as a
 * property of the calendar, when it is a property of the term, and it would
 * be the same 12 beside four other rows.
 *
 * So: a screen that keeps a list of its own gets its length, and a screen
 * that is a tool, a report or a view over somebody else's list gets no number
 * at all. `null` means the row shows nothing, which is the honest default and
 * why the map below is deliberately short of fifty-four entries.
 */
export function heldBy(screen: Screen, state: State, catalog: Catalog): string | null {
  const n = (count: number, one: string, many = `${one}s`) =>
    count === 0 ? 'empty' : `${count} ${count === 1 ? one : many}`;

  switch (screen) {
    case 'courses':
    case 'study':
    case 'edit':
      return n(catalog.courses.length, 'course');
    case 'mine':
      return n(state.tasks.length + state.notes.length + state.appointments.length, 'item');
    case 'sources':
      return n(state.sources.length, 'source');
    case 'people':
      return n(state.people.length + state.letters.length, 'record');
    case 'applying':
      return n(state.applications.length, 'application');
    case 'clocks':
      return n(state.timers.length + state.alarms.length, 'timer');
    case 'links':
      return n(state.extraLinks.length, 'link');
    case 'maps':
      return n(state.places.length, 'saved place');
    case 'degree':
      return n(state.taken.length, 'course taken', 'courses taken');
    case 'connect':
      return n(state.feeds.length, 'feed');
    case 'notifs':
      // A record of switches, not a list of alerts: the count that means
      // something here is how many kinds are on.
      return n(Object.values(state.notifs).filter(Boolean).length, 'alert on', 'alerts on');
    case 'costs':
      return n(state.costs.length, 'cost');
    case 'registrar':
      return n(state.registrar.length, 'date');
    case 'activities':
      return n(state.commitments.length, 'commitment');
    case 'exam':
      return n(state.sittings.length, 'paper sat', 'papers sat');
    case 'update':
      return n(state.updates.length, 'addition');
    case 'housing':
      return n(state.residences.length, 'room');
    case 'meals':
      return n(state.balances.length, 'balance');
    case 'calendar':
    case 'home':
      return n(catalog.items.length, 'deadline');
    default:
      return null;
  }
}

/**
 * Why a screen exists, for somebody who has never opened it.
 *
 * Not the blurb. The blurb says what the screen does, which is the right
 * sentence for a directory you are browsing and the wrong one for a row you
 * have skipped fifty times — if the blurb had persuaded you, you would have
 * opened it. These name the problem instead, and several of them name a
 * problem you only recognise afterwards, which is exactly why the screen went
 * unopened.
 *
 * Second person, no exclamation marks, and no promises the screen does not
 * keep. A screen with nothing honest to say here is left out and shows its
 * blurb — which is better than a line written to fill the column.
 */
export const WHY: Partial<Record<Screen, string>> = {
  brief: 'Two minutes at each end of the day beats trying to hold the whole week in your head.',
  registrar: 'The drop deadline is not on your syllabus, and missing it costs a semester.',
  announce:
    'A professor moves a deadline by email, and the app is the last thing to hear about it — and syllabus dates and the LMS calendar disagree more often than either admits.',
  behind: 'When you are already behind, the useful question is what to drop, not how to catch up.',
  runway: 'Three weeks before a final is when a plan is still worth making.',
  tonight: 'You have four hours and five courses; this says which four hours are worth the most.',
  ahead: 'A week that looks fine on a calendar can be twenty-six hours of work.',
  courses:
    'Every syllabus in one place — and on its grades grain, what you need on the final, which is arithmetic nobody does by hand.',
  degree: 'Four years of requirements, and the advisor meeting is twenty minutes long.',
  costs: 'Textbook money is the one budget nobody tracks until the term is over.',
  solve: 'A worked answer teaches nothing; the method on different numbers does.',
  exam: 'Recognising a card is not the same as sitting a paper, and only one of them is the exam.',
  analyse: 'A CSV and a statistics course are not the same skill, and the second one is what is being marked.',
  draw: 'Some things are a diagram, and drawing one by hand is why you end up writing a paragraph instead.',
  deck: 'A presentation is due and the deck is the part that always starts at midnight.',
  proof: 'The typo you cannot see is the one you have read six times.',
  essay: 'Cover letters and personal statements are writing, and they are not coursework — this is fenced off from your courses on purpose.',
  sources: 'The reading you cannot find again is a reading you did not do.',
  work: 'An assignment brief is a wall of text hiding four dates and a rubric.',
  update: 'Material arrives all term, and a course that stops at the syllabus goes stale by October.',
  people: 'The letter you need in April is written by somebody you should be talking to now.',
  applying: 'Internship deadlines land on the same days as your coursework, and neither knows about the other.',
  classmates: 'Every class has people in it, and none of them are in your phone.',
  groupwork: 'Group projects fail on who was doing what, not on the work.',
  activities: 'Clubs, a job and a team are real hours, and they are the ones missing from your week.',
  housing: 'Move-out is counted from your last exam, not from the date on the email.',
  meals: 'Running out of swipes in week eleven is a thing that happens to people who never looked.',
  maps: 'A building code is not a location, and ten minutes between classes is not much.',
  yes: 'Registration opens at a time, and the good sections go in the first hour.',
  mail: 'The email you are putting off is usually four sentences.',
  connect: 'The calendar you already keep can feed this one instead of being retyped.',
  clocks: 'A countdown you can see is the difference between a study hour and an evening.',
  export: 'It is your data, and being able to leave is what makes staying a choice.',
  privacy: 'Worth reading once, so you know what this thing does and does not send.',
  data: 'The browser gives an app about five megabytes, and it does not warn you before it stops writing.',
  account: 'Your phone and your laptop hold different halves of the term until this is on.',
  help: 'Written from the app itself, so it cannot describe a feature that is not there.',
  settings: 'The defaults were somebody else’s guess about how you work.',
  notifs: 'The things the app would have poked you about, if you had let it.',
};

/** How long ago, in the plainest words that are still true. */
export function openedLabel(at: number | undefined, now: number): string {
  if (!at) return 'Never opened';
  const days = Math.floor((dayOf(now) - at) / DAY);
  if (days <= 0) return 'Opened today';
  if (days === 1) return 'Opened yesterday';
  if (days < 7) return `Opened ${days} days ago`;
  if (days < 14) return 'Opened last week';
  if (days < 60) return `Opened ${Math.round(days / 7)} weeks ago`;
  if (days < 365) return `Opened ${Math.round(days / 30)} months ago`;
  return 'Opened over a year ago';
}

/**
 * Screens never opened, or not opened this term.
 *
 * Two different things in one list on purpose: a screen you have never seen
 * and a screen you tried in August and forgot are the same problem from the
 * student's side, which is that it is not part of how they use the app.
 */
export function untried(
  rows: Destination[],
  visited: Record<string, boolean>,
  lastOpened: Record<string, number>,
  now: number,
): Destination[] {
  const stale = dayOf(now) - STALE_DAYS * DAY;
  return rows.filter((d) => {
    if (!visited[d.screen]) return true;
    const at = lastOpened[d.screen];
    // Opened before this field existed: `visited` says yes and there is no
    // date. That is not "not tried" — see the note in `state/shape.ts` about
    // why no date was invented for those.
    if (!at) return false;
    return at < stale;
  });
}

/** The tag sections, each with the screens that carry it, in registry order. */
export function byTask(rows: Destination[]): { tag: TaskTag; label: string; rows: Destination[] }[] {
  return TASKS.map(([tag]) => ({
    tag,
    label: taskLabel(tag),
    rows: rows.filter((d) => d.taskTags.includes(tag)),
  })).filter((s) => s.rows.length > 0);
}

/** Which of the four views a hit came from, so a result can say so. */
export type View = 'area' | 'task' | 'untried' | 'keys';

/** Every screen in the registry, for callers that do not filter by school. */
export function everyScreen(): Destination[] {
  return DESTINATIONS;
}
