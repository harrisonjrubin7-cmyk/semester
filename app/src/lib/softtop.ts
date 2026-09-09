/**
 * What the soft shell puts above and below every screen.
 *
 * The handoff's structure is the same on all fifty-five: a hero card carrying
 * one dominant fact, a row of two or three numbers that qualify it, the
 * screen's own content, and a bar at the foot with the action you came to
 * take. Only the facts differ.
 *
 * So the facts are the registry and the structure is a component, the same
 * division `lib/nav.ts` already makes for the directory. Fifty-five screens
 * did not each grow a hand-rolled header: `components/soft/SoftTop.tsx`
 * renders whatever this returns, once, in `App.tsx`.
 *
 * ## Data, not markup
 *
 * Everything here is strings and numbers. That is what makes it testable
 * without a DOM — `softtop.test.ts` walks all fifty-five and checks the rules
 * below hold for every one — and it is what keeps the inline-style count
 * falling rather than rising, since a spec cannot carry a style object.
 *
 * ## Two rules the tests enforce
 *
 * **Never an empty hero.** A hero renders a figure or a sentence, never a
 * dash. Where a screen has no number worth reading first, `said` carries the
 * fact instead — and where it has neither, it gets no hero at all, which is
 * what the handoff asks for on the prose screens.
 *
 * **Never the blurb.** The description line under the tab rows already shows
 * it. A hero that repeats it has spent the biggest type on the page saying
 * what the small type just said.
 */

import type { Catalog } from '../data/catalog';
import type { Action, State } from '../state/shape';
import type { DatedItem, Screen } from './types';
import type { Capabilities } from './school';
import { swipeUnit } from './school';
import { datedItems, nextClass, upcomingItems } from './select';
import { overdueCount } from './standing';
import { week as weekAhead, headline, pressure, showHours } from './ahead';
import { standing } from './grades';
import { isExam } from './runway';
import { behindLine, howBehind } from './behind';
import { WAKING_HOURS, hoursOn } from './windows';
import { DESTINATIONS } from './nav';
import { tally } from './review';
import { bytesOf } from './inventory';
import { pickPersisted } from '../state/shape';

export interface TopHero {
  label: string;
  /** The small caps note on the right of the hero's top line. */
  meta?: string;
  /** The dominant fact as a number, already formatted. */
  figure?: string;
  /** The dominant fact as a sentence, where the screen has no number. */
  said?: string;
  foot?: string;
}

export interface TopStat {
  label: string;
  value: string;
  /** 0–1, for the stats that are a part of a whole. */
  fraction?: number;
}

/** One action, named by where it goes. The registry never holds a callback. */
export interface TopAction {
  label: string;
  screen: Screen;
  /**
   * Set before the navigation, where the screen has more than one thing on it.
   *
   * A destination used to be one screen doing one thing, so a label and a
   * screen name said everything. Two merges later some screens carry a switch
   * — the report's grain, the source a changed date arrived in — and "Check
   * the dates" landing on the half about pasted emails is the action not
   * kept. Still no callback: this is an action object the registry describes
   * and `SoftTop` dispatches.
   */
  also?: Action;
}

export interface TopBar {
  status?: string;
  primary: TopAction;
}

export interface SoftTop {
  hero: TopHero | null;
  stats: TopStat[];
  bar: TopBar | null;
}

export interface TopInput {
  state: State;
  catalog: Catalog;
  now: Date;
  caps: Capabilities;
  /**
   * How the account copy is doing, for the one screen that reports it.
   *
   * Not derivable from `state`: it is the store's own account of a network
   * conversation, and Settings is the screen somebody opens to ask about it.
   */
  sync?: string;
}

const nothing: SoftTop = { hero: null, stats: [], bar: null };

/**
 * A screen with no number and no list: a tool you type into, or prose.
 *
 * It keeps the bar and loses the hero, which is what the handoff asks for —
 * "prose screens keep title, tab rows, description and bottom bar". A hero
 * over a blank compose box would have to invent its fact, and the only one to
 * hand is the blurb the description line is already showing.
 */
const prose = (primary: TopAction): SoftTop => ({ hero: null, stats: [], bar: { primary } });

/** `n` of a thing, pluralised, for a foot line rather than a figure. */
function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A count as a stat value. Stats are always numbers; the label carries the noun. */
const num = (n: number): string => String(n);

/**
 * How far through the term the deadlines say we are.
 *
 * The app has no term start and end — `activeTermId` is still zero, and the
 * one place a term's shape is written down is the spread of its own
 * deadlines. First deadline to last is a proxy and is named as one wherever
 * it is shown ("of the term's deadlines"), rather than claimed as a calendar.
 */
function termProgress(items: DatedItem[], now: Date): number | null {
  const times = items.map((i) => i.date.getTime()).filter((t) => !Number.isNaN(t));
  if (times.length < 2) return null;
  const first = Math.min(...times);
  const last = Math.max(...times);
  if (last <= first) return null;
  return Math.max(0, Math.min(1, (now.getTime() - first) / (last - first)));
}

/** The running grade across every course that has one, weighted by nothing. */
function runningGrade(input: TopInput): { pct: number; scored: number } | null {
  const { state, catalog } = input;
  const each = catalog.courses
    .map((c) =>
      standing(c, state.grades, {
        pieces: state.pieces,
        drops: state.drops,
      }).current,
    )
    .filter((n): n is number => n !== null);
  if (each.length === 0) return null;
  return {
    pct: Math.round(each.reduce((a, b) => a + b, 0) / each.length),
    scored: each.length,
  };
}

/**
 * The soft shell's top and bottom for one screen.
 *
 * A screen absent from the switch gets `nothing`, which renders as the plain
 * body it already was — so a screen added to the app is never broken by this
 * file, only unadorned by it until somebody says what its dominant fact is.
 * `softtop.test.ts` fails when a registry screen is in that state, which is
 * how "unadorned" stays a decision rather than an oversight.
 */
export function softTop(screen: Screen, input: TopInput): SoftTop {
  const { state, catalog, now, caps } = input;
  const dated = datedItems(catalog, now);
  const due = dated.filter((i) => i.isToday && !state.done[i.id]);
  const settledToday = dated.filter((i) => i.isToday);
  const doneToday = settledToday.filter((i) => state.done[i.id]);
  const overdue = overdueCount(dated, state.done);
  const soon = upcomingItems(catalog, now).filter((i) => !i.isToday && i.daysAway <= 7);
  const courses = catalog.courses.length;

  /** The three numbers most screens qualify their hero with. */
  const term: TopStat[] = [
    { label: 'Due today', value: num(due.length), fraction: settledToday.length ? doneToday.length / settledToday.length : undefined },
    { label: 'This week', value: num(soon.length) },
    { label: 'Overdue', value: num(overdue) },
  ];

  /** A screen that keeps a list: its length is the fact, and zero is a fact too. */
  const holds = (
    label: string,
    n: number,
    one: string,
    primary: TopAction,
    many?: string,
    /** Where the school names the thing — "board meals" rather than "meals". */
    note?: string,
  ): SoftTop => ({
    hero: {
      label,
      meta: note,
      figure: num(n),
      foot: n === 0 ? `No ${many ?? `${one}s`} yet` : count(n, one, many),
    },
    stats: term,
    bar: { primary },
  });

  switch (screen) {
    // ── Semester ──────────────────────────────────────────────────────────
    case 'home': {
      const next = nextClass(catalog, now);
      const first = due[0];
      return {
        hero: next
          ? {
              label: 'Next class',
              meta: next.untilLabel,
              figure: next.block.time,
              foot: next.block.title,
            }
          : { label: 'Today', said: 'No class today.', foot: count(due.length, 'thing') + ' still due' },
        stats: term,
        bar: {
          status: first ? `${count(due.length, 'thing')} left today` : 'Nothing left today',
          primary: first
            ? { label: 'Start the next thing', screen: 'work' }
            : { label: 'Plan tonight', screen: 'tonight' },
        },
      };
    }

    case 'brief': {
      /*
       * One screen, three spans — so three heroes.
       *
       * The report used to be three screens and the hero was written per
       * screen. Now the grain is state, and a hero that ignored it would put
       * today's count above the term's report. The spans stay what they were:
       * the day is today, the week is the last seven days, the term is the
       * term, and counting the term under all three would be the same number
       * under three different questions.
       */
      const ticked = dated.filter((i) => state.done[i.id]);
      if (state.report === 'week') {
        const lastWeek = ticked.filter((i) => i.daysAway <= 0 && i.daysAway >= -7);
        return {
          hero: { label: 'This week', meta: 'Last seven days', figure: num(lastWeek.length), foot: 'ticked off' },
          stats: term,
          bar: { primary: { label: 'The week ahead', screen: 'ahead' } },
        };
      }
      if (state.report === 'term') {
        return {
          hero: { label: 'What worked', meta: 'This term', figure: num(ticked.length), foot: 'ticked off so far' },
          stats: term,
          bar: { primary: { label: 'The week ahead', screen: 'ahead' } },
        };
      }
      return {
        hero: {
          label: 'Your day',
          meta: `${doneToday.length} done`,
          figure: num(due.length),
          foot: due.length === 0 ? 'Nothing left today' : count(due.length, 'thing') + ' still due',
        },
        stats: term,
        bar: { primary: { label: 'Plan tonight', screen: 'tonight' } },
      };
    }

    case 'calendar':
      return {
        hero: {
          label: 'Deadlines',
          meta: state.term || undefined,
          figure: num(catalog.items.length),
          foot: count(courses, 'course') + ' this term',
        },
        stats: term,
        bar: {
          primary: {
            label: 'Check the dates',
            screen: 'announce',
            also: { type: 'setChanges', source: 'feed' },
          },
        },
      };

    case 'tonight': {
      const hours = state.dayBudget;
      return {
        hero: hours
          ? { label: 'Tonight', figure: showHours(hours), foot: 'to spend on ' + count(soon.length + due.length, 'thing') }
          : { label: 'Tonight', said: 'Say how long you have, and this ranks the hours.', foot: count(due.length, 'thing') + ' due today' },
        stats: term,
        bar: { primary: { label: 'Start the next thing', screen: 'work' } },
      };
    }

    case 'ahead': {
      const w = weekAhead({
        catalog,
        from: now,
        done: state.done,
        commitments: state.commitments,
        appointments: state.appointments,
      });
      return {
        hero: {
          label: 'The week ahead',
          meta: showHours(w.promised),
          said: headline(w),
          foot: pressure(w) || undefined,
        },
        stats: [
          { label: 'Deadlines', value: num(w.due.length) },
          { label: 'Promised', value: showHours(w.promised) },
          { label: 'Overdue', value: num(overdue) },
        ],
        bar: { primary: { label: 'When you are behind', screen: 'behind' } },
      };
    }

    // ── Courses ───────────────────────────────────────────────────────────
    case 'courses': {
      const through = termProgress(dated, now);
      return {
        hero: through === null
          ? { label: 'Courses', figure: num(courses), foot: courses === 0 ? 'Add a syllabus to start' : count(catalog.items.length, 'deadline') }
          : {
              label: 'Term progress',
              meta: count(courses, 'course'),
              figure: `${Math.round(through * 100)}%`,
              foot: 'of the term’s deadlines are behind you',
            },
        stats: [
          { label: 'Courses', value: num(courses) },
          { label: 'Deadlines', value: num(catalog.items.length), fraction: through ?? undefined },
          { label: 'Overdue', value: num(overdue) },
        ],
        bar: { primary: { label: 'Add a course', screen: 'import' } },
      };
    }

    case 'registrar':
      return holds('Term deadlines', state.registrar.length, 'date', {
        label: 'Check the dates',
        screen: 'announce',
        also: { type: 'setChanges', source: 'feed' },
      });

    case 'import':
      return {
        hero: {
          label: 'Courses so far',
          figure: num(courses),
          foot: courses === 0 ? 'Nothing loaded yet' : count(catalog.items.length, 'deadline') + ' between them',
        },
        stats: term,
        bar: { primary: { label: 'Edit the course', screen: 'edit' } },
      };

    case 'edit':
      return {
        hero: { label: 'Courses', figure: num(courses), foot: count(catalog.items.length, 'deadline') + ' between them' },
        stats: term,
        bar: { primary: { label: 'Back to courses', screen: 'courses' } },
      };

    case 'announce':
      // Not "Check the dates" any more: that is this screen's other source, so
      // the bar would offer the screen you are standing on. After a change is
      // applied the next thing is the course it changed.
      return holds('Folded in', state.updates.length, 'addition', { label: 'Edit the course', screen: 'edit' });

    // ── Study ─────────────────────────────────────────────────────────────
    case 'study': {
      // Cards you have seen and are due again. The ones you have never opened
      // are not counted, because their keys live in each course's guide and
      // this file stays clear of the catalogue's contents.
      const seen = Object.values(state.reviews).filter((r) => r.seen > 0);
      const ready = seen.filter((r) => r.due <= now.getTime()).length;
      const t = tally(state.reviews);
      return {
        hero: {
          label: 'Cards due',
          meta: count(courses, 'course'),
          figure: num(ready),
          foot: t.cards === 0 ? 'Nothing drilled yet' : count(t.cards, 'card') + ' answered so far',
        },
        stats: [
          { label: 'Accuracy', value: t.cards ? `${t.pct}%` : '—', fraction: t.cards ? t.pct / 100 : undefined },
          { label: 'Cards seen', value: num(t.cards) },
          { label: 'Courses', value: num(courses) },
        ],
        bar: { primary: { label: 'Ask about this course', screen: 'ask' } },
      };
    }

    case 'ask':
      return {
        hero: {
          label: 'Ask Claude',
          said: courses === 0 ? 'No course loaded, so answers come without a guide in hand.' : `Answering with ${count(courses, 'course')} in hand.`,
        },
        stats: term,
        bar: { primary: { label: 'Study', screen: 'study' } },
      };

    case 'update':
      return holds('Additions', state.updates.length, 'addition', { label: 'Study', screen: 'study' });

    case 'exam':
      return holds('Papers sat', state.sittings.length, 'paper sat', { label: 'Exam runway', screen: 'runway' }, 'papers sat');

    case 'runway': {
      // `isExam` is the app's own definition, shared with the runway screen —
      // a second regex here would be a second answer to the same question.
      const nextExam = upcomingItems(catalog, now).find(isExam);
      return {
        hero: nextExam
          ? { label: 'Next exam', meta: nextExam.title, figure: `${nextExam.daysAway}d`, foot: 'to plan backwards from' }
          : { label: 'Exam runway', said: 'No exam on the calendar to count back from.', foot: count(soon.length, 'deadline') + ' in the next week' },
        stats: term,
        bar: { primary: { label: 'Sit a practice paper', screen: 'exam' } },
      };
    }

    case 'solve':
    case 'analyse':
      return {
        hero: {
          label: screen === 'solve' ? 'Work the problem' : 'Analyse data',
          said: courses === 0 ? 'No course loaded, so the method comes without one.' : `Worked against ${count(courses, 'course')}.`,
        },
        stats: term,
        bar: { primary: { label: 'Study', screen: 'study' } },
      };

    // ── Make ──────────────────────────────────────────────────────────────
    case 'work':
      return {
        hero: {
          label: 'Work on it',
          meta: due.length ? `${count(due.length, 'thing')} today` : undefined,
          figure: num(soon.length),
          foot: soon.length === 0 ? 'Nothing due this week' : 'due in the next seven days',
        },
        stats: term,
        bar: { primary: { label: 'Tonight', screen: 'tonight' } },
      };

    case 'essay':
      return prose({ label: 'Check the writing', screen: 'proof' });

    case 'proof':
      return prose({ label: 'Draft it', screen: 'essay' });

    case 'draw':
      return prose({ label: 'Make a deck', screen: 'deck' });

    case 'deck':
      return prose({ label: 'Draw it', screen: 'draw' });

    case 'mail':
      return prose({ label: 'Check the writing', screen: 'proof' });

    case 'sources':
      return holds('Sources', state.sources.length, 'source', { label: 'Draft it', screen: 'essay' });

    // ── Standing ──────────────────────────────────────────────────────────
    case 'grades': {
      const g = runningGrade(input);
      return {
        hero: g
          ? { label: 'Running grade', meta: count(g.scored, 'course'), figure: `${g.pct}%`, foot: 'across everything entered' }
          : { label: 'Grades', said: 'No scores entered yet, so there is nothing to average.', foot: count(courses, 'course') + ' waiting' },
        stats: [
          { label: 'Scored', value: num(Object.keys(state.grades).length) },
          { label: 'Courses', value: num(courses), fraction: courses && g ? g.scored / courses : undefined },
          { label: 'Overdue', value: num(overdue) },
        ],
        bar: { primary: { label: 'The degree', screen: 'degree' } },
      };
    }

    case 'degree':
      return holds('Courses taken', state.taken.length, 'course taken', { label: 'Registration', screen: 'yes' }, 'courses taken');

    case 'behind': {
      // The hours are the student's own, and the sentence is the one the
      // screen itself opens with — the same derivation, not a paraphrase.
      const hours =
        state.windows.length > 0
          ? [0, 1, 2, 3, 4, 5, 6].reduce((n, d) => n + hoursOn(state.windows, d), 0)
          : WAKING_HOURS * 7;
      const b = howBehind(dated, state.done, state.spent, hours);
      return {
        hero: {
          label: 'When you are behind',
          meta: overdue ? `${overdue} overdue` : undefined,
          said: behindLine(b),
          foot: b.needed > 0 ? `${showHours(b.needed)} of work against ${showHours(b.there)}` : undefined,
        },
        stats: term,
        bar: { primary: { label: 'Tonight', screen: 'tonight' } },
      };
    }

    // ── Campus ────────────────────────────────────────────────────────────
    case 'meals':
      // The noun is the school's, not ours: "swipes" at one, "board meals" at
      // another, and "meals" where nothing has been declared.
      return holds('Balances', state.balances.length, 'balance', { label: 'Costs', screen: 'costs' }, undefined, swipeUnit(caps));

    case 'housing':
      return holds('Rooms', state.residences.length, 'room', { label: 'Getting there', screen: 'maps' });

    case 'maps':
      return holds('Saved places', state.places.length, 'place', { label: 'Links', screen: 'links' });

    case 'yes':
      return {
        hero: { label: 'Registration', said: `${count(state.taken.length, 'course')} taken so far.`, foot: count(courses, 'course') + ' this term' },
        stats: term,
        bar: { primary: { label: 'The degree', screen: 'degree' } },
      };

    case 'classmates':
      return {
        hero: { label: 'Classmates', figure: num(courses), foot: courses === 0 ? 'No courses to share yet' : 'rooms, one per class' },
        stats: term,
        bar: { primary: { label: 'Group work', screen: 'groupwork' } },
      };

    case 'activities':
      return holds('Commitments', state.commitments.length, 'commitment', { label: 'The week ahead', screen: 'ahead' });

    case 'groupwork':
      return {
        hero: { label: 'Group work', figure: num(courses), foot: 'courses that could carry a project' },
        stats: term,
        bar: { primary: { label: 'Classmates', screen: 'classmates' } },
      };

    // ── Life ──────────────────────────────────────────────────────────────
    case 'mine':
      return holds('Personal', state.tasks.length + state.notes.length + state.appointments.length, 'item', { label: 'Timers and alarms', screen: 'clocks' });

    case 'clocks':
      return holds('Timers', state.timers.length + state.alarms.length, 'timer', { label: 'Tonight', screen: 'tonight' });

    case 'applying':
      return holds('Applications', state.applications.length, 'application', { label: 'People and letters', screen: 'people' });

    case 'people':
      return holds('People', state.people.length + state.letters.length, 'record', { label: 'Applications', screen: 'applying' });

    case 'costs':
      return holds('Costs', state.costs.length, 'cost', { label: 'Meal plan', screen: 'meals' });

    case 'links':
      return holds('Links', state.extraLinks.length, 'link', { label: 'Getting there', screen: 'maps' });

    // ── You ───────────────────────────────────────────────────────────────
    case 'me': {
      const through = termProgress(dated, now);
      return {
        hero: {
          label: 'Term at a glance',
          meta: count(courses, 'course'),
          figure: through === null ? num(catalog.items.length) : `${Math.round(through * 100)}%`,
          foot: through === null ? 'deadlines this term' : 'of the term’s deadlines are behind you',
        },
        stats: term,
        bar: { primary: { label: 'Everything', screen: 'everything' } },
      };
    }

    case 'account':
      return {
        hero: {
          label: 'Account',
          said: state.myName ? `Signed in as ${state.myName}.` : 'Not signed in, so this semester lives on this device only.',
        },
        stats: term,
        bar: { primary: { label: 'Connect accounts', screen: 'connect' } },
      };

    case 'connect':
      // Where a feed ends up, rather than a second accounts screen: what a
      // subscribed calendar is for is the dates showing on the day rail.
      return holds('Feeds', state.feeds.length, 'feed', { label: 'Calendar', screen: 'calendar' });

    case 'settings': {
      /*
       * Storage and sync, which is what the handoff asks this row for.
       *
       * It was courses, alerts and screens-used — three true numbers about
       * the semester on a screen that is not about the semester. What
       * somebody opens Settings to find out is where their data is and
       * whether the other device has it, and neither was anywhere on it.
       */
      const kb = Math.round(bytesOf(pickPersisted(state)) / 1024);
      return {
        hero: null,
        stats: [
          { label: 'On this device', value: kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB` },
          { label: 'Account', value: input.sync ?? '—' },
          { label: 'Alerts on', value: num(Object.values(state.notifs).filter(Boolean).length) },
        ],
        /*
         * No bar here.
         *
         * Every screen the soft shell draws gets one because the bar is where
         * the next thing to do lives — on a screen that shows you a fact, the
         * action that fact implies is somewhere else. Settings is not that
         * screen. Its whole body is the list of places you can go, so the bar
         * could only ever offer one of the rows already on it, and it did:
         * "Your data" sat in a filled pill under a "Your data" row four
         * hundred pixels above it. Two routes to one screen, one screen apart
         * — the exact duplication the index was rebuilt to remove.
         *
         * So the index keeps its stats, which say something the rows do not,
         * and loses the bar. `SOFT_NO_BAR` in `softtop.test.ts` is the list
         * of screens allowed to do this, so a second one cannot appear
         * without somebody saying why.
         */
        bar: null,
      };
    }

    case 'notifs':
      return {
        hero: {
          label: 'Alerts',
          figure: num(Object.values(state.notifs).filter(Boolean).length),
          foot: 'kinds switched on',
        },
        stats: term,
        bar: { primary: { label: 'Settings', screen: 'settings' } },
      };

    case 'everything':
      return {
        hero: {
          label: 'Everything',
          meta: `${Object.keys(state.visited).length} opened`,
          figure: num(DESTINATIONS.length),
          foot: 'screens in the app',
        },
        stats: term,
        bar: { primary: { label: 'How this works', screen: 'help' } },
      };

    case 'help':
      return prose({ label: 'Everything', screen: 'everything' });

    // ── Data ──────────────────────────────────────────────────────────────
    case 'data':
      return {
        hero: {
          label: 'Your data',
          figure: num(
            state.tasks.length + state.notes.length + state.appointments.length + state.sources.length + state.people.length,
          ),
          foot: 'tasks, notes, appointments, sources and people',
        },
        stats: term,
        bar: { primary: { label: 'Take it with you', screen: 'export' } },
      };

    case 'export':
      return {
        hero: {
          label: 'Take it with you',
          said: 'Everything the app holds, in formats other software reads.',
          foot: count(courses, 'course') + ', ' + count(catalog.items.length, 'deadline'),
        },
        stats: term,
        bar: { primary: { label: 'Your data', screen: 'data' } },
      };

    case 'privacy':
      return prose({ label: 'Your data', screen: 'data' });

    default:
      return nothing;
  }
}
