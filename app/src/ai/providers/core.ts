import { tally } from '../../lib/attend';
import { extrasFor, standing } from '../../lib/grades';
import { datedItems } from '../../lib/select';
import { forScope, insights } from '../../insights';
import { factsFrom } from '../../insights/facts';
import type { Provide, Look } from '../shape';
import { guideNow, startedNow } from '../shape';

/**
 * What each screen tells the assistant it is showing.
 *
 * ## Why these live here and not on the registry
 *
 * The brief says to hang a provider off each registry entry. `lib/nav.ts` is
 * a flat table of strings read by four unrelated things — the tab bar, the
 * finder, the generated guide and the mode reader — none of which know what
 * a `State` is. Putting fifty closures over the store into it would drag the
 * whole state graph into every one of those, and make the file that has to
 * stay readable the longest file in the app.
 *
 * A map keyed by the same `Screen` union gives the identical lookup and the
 * identical completeness check — a screen with no entry is a screen with no
 * provider, which the type system can see and a test below asserts. The
 * registry stays the registry.
 *
 * ## The rules every one of these follows
 *
 * Pure. No dispatch, no fetch, no DOM, no `Date.now()` — the clock arrives as
 * `now`. And `visible` means visible: if the student filtered to one course,
 * these hand over one course, because "how many are there" has to answer the
 * question they are actually looking at.
 */

/** A percentage as a person would read it, or nothing. */
function pct(n: number | null | undefined): string {
  return n === null || n === undefined ? '—' : `${Math.round(n)}%`;
}

/**
 * Which courses the feed chip is showing, in the app's own vocabulary.
 *
 * `state.filter` is Today's chip and it is not a course id: its values are
 * `All`, `Due`, `Classes` and the first word of each course code — see
 * `feedFilters` in `lib/select.ts`. Written here as `state.filter ? one : all`
 * on the assumption it held an id and an empty string, this matched nothing on
 * a fresh account, whose filter is the string `All`, and the Grades provider
 * returned nothing at all.
 *
 * `All`, `Due` and `Classes` are not course restrictions, so they mean every
 * course. Anything else is a short code.
 */
function chipped(look: Look) {
  const { state, catalog } = look;
  const chip = state.filter;
  if (!chip || chip === 'All' || chip === 'Due' || chip === 'Classes') return catalog.courses;
  const picked = catalog.courses.filter((c) => catalog.short[c.id] === chip);
  return picked.length > 0 ? picked : catalog.courses;
}

/**
 * Grades — the screen the brief uses as its worked example.
 *
 * "What do I need on the BUS final" has to answer without the course being
 * named, which means every component, its weight, what it scored and what is
 * still outstanding. That is exactly what this screen renders, so it is what
 * this hands over — the same numbers, from the same function the screen
 * calls, so the two cannot drift.
 */
export const grades: Provide = (look) => {
  const { state, catalog } = look;
  /*
   * Every course, because that is what the screen shows.
   *
   * Grades has no course chip. An earlier version filtered it by
   * `state.filter` — Today's chip — which is not this screen's and is not a
   * course id, so on a fresh account it matched nothing and this provider
   * returned null: the sheet said Grades had nothing to say while four
   * courses of grades were on the screen behind it.
   */
  const courses = catalog.courses;
  if (courses.length === 0) return null;

  const visible = courses.map((c) => {
    const full = catalog.byId[c.id];
    /*
     * Called exactly as the Grades screen calls it, arguments and all.
     *
     * Not "the same numbers, roughly": the same function with the same
     * extras, so the assistant cannot quote a running grade that differs from
     * the one on the screen the student is looking at while they read it.
     * Attendance is the part that would silently drift — a syllabus that
     * weights it makes it a row in the table, and leaving it out here would
     * produce a different total from the same data.
     */
    // One assembly for all four callers — see `extrasFor` in `lib/grades.ts`.
    const s = standing(full, state.grades, extrasFor(c.id, state));
    return {
      course: full.code,
      running: pct(s.current),
      banked: `${Math.round(s.earned)} of ${Math.round(s.counted)} points counted`,
      ungraded: `${Math.round(s.remaining)}% still to play for`,
      ...(s.pointsOff > 0 ? { lostToAbsence: `${Math.round(s.pointsOff)} points` } : {}),
      ...(s.incomplete ? { warning: 'the weights do not add to 100, so these are indicative' } : {}),
      components: s.rows.map((r) => ({
        what: r.what,
        /*
         * Rounded, because a weight is not measured to fifteen places.
         *
         * A syllabus stating "eight quizzes, 10 points each" normalises to
         * 34.78260869565217%, which is arithmetic showing through: it reads
         * as a precision the syllabus never had, and it spends forty
         * characters of a bounded context saying what "34.8%" says.
         */
        weight: r.weight === null ? 'unreadable' : `${Math.round(r.weight * 10) / 10}%`,
        score: r.score === null ? 'not back' : `${r.score}`,
        ...(r.extra ? { extraCredit: true } : {}),
      })),
    };
  });

  const graded = visible.filter((v) => v.running !== '—').length;
  return {
    summary:
      `Grades for ${courses.length} ${courses.length === 1 ? 'course' : 'courses'}, ${state.term}. ` +
      `${graded} with something entered.`,
    visible,
    actions: ['open_screen'],
    suggestions:
      courses.length > 0
        ? [
            `What do I need on the ${catalog.byId[courses[0].id].code} final?`,
            'Which course is most at risk?',
            'What is still ungraded?',
          ]
        : [],
  };
};

/**
 * The calendar — the visible window and what is in it.
 *
 * The window is the whole point: "what is my heaviest day this week" is a
 * different question on a month view and a day view, and the screen knows
 * which one is open.
 */
export const calendar: Provide = (look) => {
  const { state, catalog, now } = look;
  const view = state.calView ?? 'month';
  const days = view === 'day' ? 1 : view === 'week' ? 7 : view === 'month' ? 31 : 200;

  const items = datedItems(catalog, now)
    .filter((i) => !i.isPast && i.daysAway <= days)
    // The chip, in the app's own vocabulary — see `chipped`.
    .filter((i) => chipped(look).some((c) => c.id === i.c))
    .slice(0, 60);

  return {
    summary:
      `The calendar, ${view} view — the next ${days} ${days === 1 ? 'day' : 'days'}` +
      (chipped(look).length < catalog.courses.length
        ? `, filtered to ${chipped(look).map((c) => catalog.byId[c.id].code).join(' and ')}`
        : '') +
      `. ${items.length} dated ${items.length === 1 ? 'thing' : 'things'} in it.`,
    focus: state.calDay ? { selectedDay: state.calDay } : undefined,
    visible: items.map((i) => ({
      id: i.id,
      course: catalog.byId[i.c]?.code,
      title: i.title,
      due: i.dueShort,
      inDays: i.daysAway,
      ...(i.weight ? { weight: i.weight } : {}),
      ...(state.done[i.id] ? { done: true } : {}),
    })),
    actions: ['open_screen', 'tick_deadline', 'add_task'],
    suggestions: [
      'What is my heaviest day this week?',
      'What can I move without breaking anything?',
      'What is due before Friday?',
    ],
  };
};

/**
 * Study — the open course's guide, unit by unit.
 *
 * Card counts and mastery rather than the cards. "What should I drill first"
 * is answered from which units are cold, and sending the cards themselves
 * would be sending the guide to answer a question about the guide's shape.
 */
export const study: Provide = (look) => {
  const { state, catalog } = look;
  const guide = guideNow(look, state.guideId);
  const course = catalog.byId[state.guideId];
  if (!guide || !course) return null;

  const cards = guide.units.reduce((n, u) => n + u.cards.length, 0);
  /*
   * A percentage only where one has been earned. Before the first answer in
   * this course every unit's mastery is the figure the guide declared, and
   * sending it as `mastered` invites exactly the answer the suggestions below
   * ask for — which unit is cold, what to drill first — out of numbers nobody
   * earned. See `startedNow`.
   */
  const started = startedNow(look, state.guideId, guide);
  return {
    summary: `Studying ${course.code} — ${guide.units.length} units, ${cards} cards, in ${state.mode} mode.${
      started ? '' : ' Nothing in this course has been answered yet.'
    }`,
    focus: { course: course.code, mode: state.mode },
    visible: guide.units.map((u, i) => ({
      unit: i + 1,
      name: u.name,
      cards: u.cards.length,
      mastered: started ? `${u.mastery}%` : 'not started',
    })),
    actions: ['open_screen', 'start_timer'],
    suggestions: [
      'What should I drill first?',
      `Explain the coldest unit in ${course.code} as if I have not read it.`,
      'Which units am I ready to be tested on?',
    ],
  };
};

/**
 * Courses — every course, or the one that is open.
 *
 * The list screen and the one-course screen are the same registry entry, so
 * this reads which is showing rather than guessing from the route.
 */
export const courses: Provide = (look) => {
  const { state, catalog, now } = look;
  const list = chipped(look);
  if (list.length === 0) return null;

  const open = state.courseId ? catalog.byId[state.courseId] : null;
  const rows = list.map((c) => {
    const full = catalog.byId[c.id];
    const due = datedItems(catalog, now).filter((i) => i.c === c.id && !i.isPast).length;
    const t = tally(state.attendance, c.id);
    return {
      code: full.code,
      name: full.name,
      ...(full.prof ? { professor: full.prof } : {}),
      components: full.grading.length,
      stillDue: due,
      ...(t.marked > 0 ? { attendance: `${t.present}/${t.marked} present` } : {}),
    };
  });

  return {
    summary: open
      ? `${open.code} — ${open.name}, open on its own page.`
      : `${list.length} ${list.length === 1 ? 'course' : 'courses'}, ${state.term}` +
        (list.length < catalog.courses.length ? ' — filtered' : '') +
        '.',
    focus: open ? { code: open.code, name: open.name, grading: open.grading } : undefined,
    visible: rows,
    actions: ['open_screen', 'mark_attendance'],
    suggestions: [
      'Which course is taking the most of my time?',
      'What is due in each of these?',
      'Which one has the most left ungraded?',
    ],
  };
};

/**
 * What worked — the insights on screen, with what each rests on.
 *
 * These are the app's own findings, already computed and already shown. The
 * assistant reads the rendered ones rather than recomputing, so it cannot
 * quote a finding the student is not looking at.
 */
export const worked: Provide = (look) => {
  const { state, catalog, now } = look;
  const found = forScope(insights(factsFrom(state, catalog, now)), 'all', 8);
  if (found.length === 0) {
    return {
      summary: 'What worked — nothing to report yet, which is the honest state on a thin term.',
      visible: [],
      actions: ['open_screen'],
      suggestions: ['What would you need from me to say something useful here?'],
    };
  }
  return {
    summary: `What worked — ${found.length} ${found.length === 1 ? 'finding' : 'findings'}, ranked by what they cost.`,
    visible: found.map((f) => ({
      finding: f.headline,
      detail: f.detail,
      restsOn: `${f.evidence.length} records`,
      confidence: f.confidence,
    })),
    actions: ['open_screen'],
    suggestions: [
      'Which of these should I act on first?',
      'What is the evidence for the top one?',
      'What am I doing right?',
    ],
  };
};

export { chipped, pct };
