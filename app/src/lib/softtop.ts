/**
 * What the soft shell puts above every screen.
 *
 * The structure is the same on all fifty-five: a hero card carrying one
 * dominant fact, a row of two or three numbers that qualify it, then the
 * screen's own content. Only the facts differ.
 *
 * So the facts are the registry and the structure is a component, the same
 * division `lib/nav.ts` already makes for the directory. Fifty-five screens
 * did not each grow a hand-rolled header: `components/soft/SoftTop.tsx`
 * renders whatever this returns, once, in `App.tsx`.
 *
 * ## There is no bar at the foot
 *
 * There was, on every screen: a filled pill holding "the action you came to
 * take". The trouble is that the app already answers that question four
 * times over — the tab bar or the springboard or the shelves, whichever
 * navigation is on; the rows and cards of the screen you are reading; the
 * search behind the header; the assistant. A fifth answer, in the largest
 * control on the page, could only ever be one of the other four said again,
 * and on an index screen it was demonstrably so: Settings drew "Your data"
 * in a pill under a "Your data" row.
 *
 * A component that can only repeat what is already on screen is chrome, not
 * navigation, and it cost a strip of every screen on a phone. So the bar is
 * gone in all three shells and the registry holds facts only. `TopAction`
 * and its `also` switch went with it — the registry no longer describes
 * anywhere to go, which is why nothing here dispatches.
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
 * fact instead — and where it has neither, it gets no hero at all: a tool you
 * type into and a page of prose have no number, and one invented for the slot
 * would be worse than the empty space.
 *
 * **Never the blurb.** The description line under the tab rows already shows
 * it. A hero that repeats it has spent the biggest type on the page saying
 * what the small type just said.
 */

import type { Catalog } from '../data/catalog';
import type { State } from '../state/shape';
import type { Screen } from './types';
import type { Capabilities } from './school';
import { swipeUnit } from './school';
import { datedItems, nextClass, upcomingItems } from './select';
import { overdueCount } from './standing';
import { termProgress } from './you';
import { week as weekAhead, headline, pressure, showHours } from './ahead';
import { standing } from './grades';
import { isExam } from './runway';
import { behindLine, howBehind } from './behind';
import { WAKING_HOURS, hoursOn } from './windows';
import { tally } from './review';
import { liveGuide } from './live';
import { meetings, pairings } from './meet';
import { bytesOf } from './inventory';
import { pickPersisted } from '../state/shape';
import { dateToIso, shiftIso } from './date';

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

export interface SoftTop {
  hero: TopHero | null;
  stats: TopStat[];
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

/**
 * No hero and no stats: the screen is drawn with nothing above it.
 *
 * This used to mean "falls through the registry", because a screen with no
 * numbers still kept a bar and so still returned something. With the bar gone
 * it is a real answer as well — a compose box or a page of prose has no
 * dominant fact — so the test that every screen is covered checks the switch
 * rather than the shape of what comes back.
 */
const nothing: SoftTop = { hero: null, stats: [] };

/** `n` of a thing, pluralised, for a foot line rather than a figure. */
function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A count as a stat value. Stats are always numbers; the label carries the noun. */
const num = (n: number): string => String(n);

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

  /**
   * The same three numbers, over your own things rather than the syllabus's.
   *
   * Personal exists to keep the two apart — `Mine.tsx` says so at the top, and
   * the app's premise depends on it: a syllabus deadline is trustworthy
   * because it came out of a PDF with a citation attached, and a task you
   * typed is a different kind of thing. The strip above it reported `term`
   * anyway, so the one screen in the app whose whole point is the separation
   * opened on "Personal · 0 · No items yet" beside "Overdue 6" — six
   * coursework deadlines, under a heading saying Personal, on a screen with
   * nothing of your own in it at all.
   *
   * Settings had the same shape and the same fix: three true numbers about
   * the semester, on the one screen that is not about the semester. See the
   * test that holds it.
   *
   * **Why Overdue counts tasks only.** An appointment is not a thing you
   * finish, it is a thing that happens, so one in the past is over rather
   * than late — calling it overdue would invent work nobody has. It counts
   * toward today and the week, where it genuinely is something on your day.
   *
   * **And why the fraction counts tasks only, for the same reason.** The
   * meter under Due today is how much of the day you have ticked off, and an
   * appointment cannot be ticked. Counting one in the denominator would leave
   * a meter that could not fill on any day with something in the diary, which
   * is worse than no meter.
   */
  const iso = dateToIso(now);
  const weekEnd = shiftIso(iso, 7);
  const mineToday = state.tasks.filter((k) => k.date === iso);
  const mine: TopStat[] = [
    {
      label: 'Due today',
      value: num(
        mineToday.filter((k) => !k.done).length +
          state.appointments.filter((a) => a.date === iso).length,
      ),
      fraction: mineToday.length ? mineToday.filter((k) => k.done).length / mineToday.length : undefined,
    },
    {
      label: 'This week',
      value: num(
        state.tasks.filter((k) => !k.done && k.date !== null && k.date > iso && k.date <= weekEnd).length +
          state.appointments.filter((a) => a.date > iso && a.date <= weekEnd).length,
      ),
    },
    {
      label: 'Overdue',
      value: num(state.tasks.filter((k) => !k.done && k.date !== null && k.date < iso).length),
    },
  ];

  /** A screen that keeps a list: its length is the fact, and zero is a fact too. */
  const holds = (
    label: string,
    n: number,
    one: string,
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
  });

  switch (screen) {
    // ── Semester ──────────────────────────────────────────────────────────
    case 'home': {
      const next = nextClass(catalog, now);
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
        };
      }
      if (state.report === 'term') {
        return {
          hero: { label: 'What worked', meta: 'This term', figure: num(ticked.length), foot: 'ticked off so far' },
          stats: term,
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
      };

    case 'tonight': {
      const hours = state.dayBudget;
      return {
        hero: hours
          ? { label: 'Tonight', figure: showHours(hours), foot: 'to spend on ' + count(soon.length + due.length, 'thing') }
          : { label: 'Tonight', said: 'Say how long you have, and this ranks the hours.', foot: count(due.length, 'thing') + ' due today' },
        stats: term,
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
      };
    }

    // ── Courses ───────────────────────────────────────────────────────────
    case 'courses': {
      /*
       * The grades grain says what it is about, not what the tab bar is about.
       *
       * Grades was a screen with a case of its own here, and it kept this hero
       * when it became a grain of Courses: somebody looking at a grade table
       * wants the running grade above it, not the term's progress. One screen,
       * two headers, chosen by the grain — the tab is the screen now, so the
       * top has to know which one it is drawing.
       */
      if (state.coursesTab === 'grades') {
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
        };
      }
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
      };
    }

    case 'registrar':
      return holds('Term deadlines', state.registrar.length, 'date');

    case 'import':
      return {
        hero: {
          label: 'Courses so far',
          figure: num(courses),
          foot: courses === 0 ? 'Nothing loaded yet' : count(catalog.items.length, 'deadline') + ' between them',
        },
        stats: term,
      };

    case 'edit':
      return {
        hero: { label: 'Courses', figure: num(courses), foot: count(catalog.items.length, 'deadline') + ' between them' },
        stats: term,
      };

    case 'announce':
      return holds('Folded in', state.updates.length, 'addition');

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
      };
    }

    case 'ask':
      return {
        hero: {
          label: 'Ask Claude',
          said: courses === 0 ? 'No course loaded, so answers come without a guide in hand.' : `Answering with ${count(courses, 'course')} in hand.`,
        },
        stats: term,
      };

    case 'update':
      return holds('Additions', state.updates.length, 'addition');

    case 'exam':
      return holds('Papers sat', state.sittings.length, 'paper sat', 'papers sat');

    case 'runway': {
      // `isExam` is the app's own definition, shared with the runway screen —
      // a second regex here would be a second answer to the same question.
      const nextExam = upcomingItems(catalog, now).find(isExam);
      return {
        hero: nextExam
          ? { label: 'Next exam', meta: nextExam.title, figure: `${nextExam.daysAway}d`, foot: 'to plan backwards from' }
          : { label: 'Exam runway', said: 'No exam on the calendar to count back from.', foot: count(soon.length, 'deadline') + ' in the next week' },
        stats: term,
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
      };

    case 'essay':
      return nothing;

    case 'proof':
      return nothing;

    case 'draw':
      return nothing;

    case 'deck':
      return nothing;

    case 'mail':
      return nothing;

    case 'sources':
      return holds('Sources', state.sources.length, 'source');

    case 'degree':
      return holds('Courses taken', state.taken.length, 'course taken', 'courses taken');

    /*
     * The count, computed the same way the screen computes it.
     *
     * A header saying five while the list below it holds four would be worse
     * than no header, so this reaches for the same live guides rather than the
     * compiled ones. It is the one case here that touches the catalogue's
     * contents, and it is why: the fact this screen is about does not exist
     * anywhere in `state`.
     */
    case 'meet': {
      const found = meetings(
        catalog.courses.map((c) => ({
          courseId: c.id,
          code: c.code,
          guide: state.updates.length
            ? liveGuide(catalog, c.id, state.updates)
            : catalog.guides[c.id],
        })).filter((s2) => s2.guide),
      );
      const pairs = pairings(found);
      return {
        hero: {
          label: 'Places they meet',
          meta: count(courses, 'course'),
          figure: num(found.length),
          foot:
            found.length === 0
              ? 'No words in common yet'
              : `${count(pairs.length, 'pair')} of courses`,
        },
        stats: term,
      };
    }

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
      };
    }

    // ── Campus ────────────────────────────────────────────────────────────
    case 'meals':
      // The noun is the school's, not ours: "swipes" at one, "board meals" at
      // another, and "meals" where nothing has been declared.
      return holds('Balances', state.balances.length, 'balance', undefined, swipeUnit(caps));

    case 'housing':
      return holds('Rooms', state.residences.length, 'room');

    case 'maps':
      return holds('Saved places', state.places.length, 'place');

    case 'yes':
      return {
        hero: { label: 'Registration', said: `${count(state.taken.length, 'course')} taken so far.`, foot: count(courses, 'course') + ' this term' },
        stats: term,
      };

    case 'classmates':
      return {
        hero: { label: 'Classmates', figure: num(courses), foot: courses === 0 ? 'No courses to share yet' : 'rooms, one per class' },
        stats: term,
      };

    case 'activities':
      return holds('Commitments', state.commitments.length, 'commitment');

    case 'groupwork':
      return {
        hero: { label: 'Group work', figure: num(courses), foot: 'courses that could carry a project' },
        stats: term,
      };

    // ── Life ──────────────────────────────────────────────────────────────
    case 'mine':
      return {
        ...holds('Personal', state.tasks.length + state.notes.length + state.appointments.length, 'item'),
        // Your own three, not the term's. See `mine` above.
        stats: mine,
      };

    case 'clocks':
      return holds('Timers', state.timers.length + state.alarms.length, 'timer');

    case 'applying':
      return holds('Applications', state.applications.length, 'application');

    case 'people':
      return holds('People', state.people.length + state.letters.length, 'record');

    case 'costs':
      return holds('Costs', state.costs.length, 'cost');

    case 'links':
      return holds('Links', state.extraLinks.length, 'link');

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
      };
    }

    case 'account':
      return {
        hero: {
          label: 'Account',
          said: state.myName ? `Signed in as ${state.myName}.` : 'Not signed in, so this semester lives on this device only.',
        },
        stats: term,
      };

    case 'connect':
      // Where a feed ends up, rather than a second accounts screen: what a
      // subscribed calendar is for is the dates showing on the day rail.
      return holds('Feeds', state.feeds.length, 'feed');

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
      };

    case 'help':
      return nothing;

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
      };

    case 'export':
      return {
        hero: {
          label: 'Take it with you',
          said: 'Everything the app holds, in formats other software reads.',
          foot: count(courses, 'course') + ', ' + count(catalog.items.length, 'deadline'),
        },
        stats: term,
      };

    case 'privacy':
      return nothing;

    default:
      return nothing;
  }
}
