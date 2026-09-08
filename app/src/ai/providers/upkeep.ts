import { budget, hasPolicy, tally } from '../../lib/attend';
import { datedItems } from '../../lib/select';
import { progress } from '../../lib/degree';
import type { Provide } from '../shape';

/**
 * The Upkeep group — keeping the app's picture of the term true.
 *
 * Syllabi move, professors send emails, dates slip. Nothing on these screens
 * changes anything without showing what it would change first, and the
 * providers say so: an assistant that offers to "apply the changes" on Check
 * the dates would be describing a button that does not work that way.
 */

/** Add a course — the import, and what is already in. */
export const importer: Provide = (look) => {
  const { state, catalog } = look;
  return {
    summary: `Importing a course from a syllabus. ${catalog.courses.length} already in, for ${state.term}.`,
    visible: catalog.courses.map((c) => ({
      code: catalog.byId[c.id].code,
      name: catalog.byId[c.id].name,
      deadlines: catalog.byId[c.id] ? datedItems(catalog, look.now).filter((i) => i.c === c.id).length : 0,
    })),
    actions: ['open_screen'],
    suggestions: [
      'What does a good syllabus import need?',
      'Why did it not find the dates in mine?',
    ],
  };
};

/** Edit the course — a syllabus is a first draft. */
export const edit: Provide = (look) => {
  const { state, catalog } = look;
  const course = catalog.byId[state.courseId || state.guideId];
  if (!course) return null;
  const items = datedItems(catalog, look.now).filter((i) => i.c === course.id);
  return {
    summary: `Editing ${course.code} — ${items.length} dated things, ${course.grading.length} graded components.`,
    focus: { code: course.code, name: course.name, grading: course.grading },
    visible: items.slice(0, 30).map((i) => ({ title: i.title, due: i.dueShort, weight: i.weight })),
    actions: ['open_screen'],
    suggestions: [
      'Does this grading add up to 100?',
      'Which of these dates looks wrong?',
      'What did the syllabus say this was worth?',
    ],
  };
};

/** The calendar half — the syllabus against what the LMS says today. */
const check: Provide = (look) => {
  const { state, catalog } = look;
  return {
    summary: `Checking syllabus dates against the connected calendars. ${state.feeds.length} ${state.feeds.length === 1 ? 'feed' : 'feeds'} connected, ${state.feedEvents.length} events pulled. Nothing is applied without being shown first.`,
    visible: state.feeds.map((f) => ({
      name: f.name,
      kind: f.kind,
      events: f.count,
      status: f.status || 'ok',
    })),
    actions: ['open_screen'],
    suggestions: [
      'Which of my dates disagree with the calendar?',
      'Why has this feed stopped syncing?',
    ],
    ...(catalog.empty ? {} : {}),
  };
};

/** Fold in an announcement — an email that moved a deadline. */
export const announce: Provide = (look) => {
  const { catalog, now } = look;
  // Two sources behind one screen — see `screens/Changes.tsx`. An assistant
  // told "you are folding in an email" while the calendar comparison is on
  // screen is an assistant looking at the wrong half.
  if (look.state.changes === 'feed') return check(look);
  const soon = datedItems(catalog, now)
    .filter((i) => !i.isPast && i.daysAway <= 45)
    .slice(0, 30)
    .map((i) => ({ id: i.id, course: catalog.byId[i.c]?.code, title: i.title, due: i.dueShort }));
  return {
    summary: `Folding in an announcement. ${soon.length} dates in the next six weeks it could move. Nothing changes until the change set is accepted.`,
    visible: soon,
    actions: ['open_screen'],
    suggestions: [
      'Which deadline does this email move?',
      'Does this change anything I have already ticked off?',
    ],
  };
};

/**
 * Weekly report — the week that happened and the one coming.
 *
 * Counts, not a narrative. The screen's own findings come from the insight
 * engine, which `worked` already hands over; repeating them here would give
 * the assistant two accounts of the same week.
 */
export const weekly: Provide = (look) => {
  const { state, catalog, now } = look;
  const week = 7 * 86_400_000;
  const items = datedItems(catalog, now);
  const finished = Object.entries(state.tickedAt).filter(
    ([, at]) => now.getTime() - at < week,
  ).length;
  const ahead = items.filter((i) => !i.isPast && i.daysAway <= 7);
  const slipped = items.filter((i) => i.isPast && !state.done[i.id]);
  return {
    summary: `The week — ${finished} ticked off in the last seven days, ${ahead.length} due in the next seven, ${slipped.length} gone by unticked.`,
    visible: ahead
      .slice(0, 25)
      .map((i) => ({ course: catalog.byId[i.c]?.code, title: i.title, due: i.dueShort, weight: i.weight })),
    actions: ['tick_deadline', 'add_task', 'open_screen'],
    suggestions: [
      'What slipped, and does it still matter?',
      'What does next week actually look like?',
    ],
  };
};

/** The week ahead — the next seven days in hours rather than items. */
export const ahead: Provide = (look) => {
  const { state, catalog, now } = look;
  const items = datedItems(catalog, now).filter((i) => !i.isPast && i.daysAway <= 7);
  const byDay = new Map<string, number>();
  for (const i of items) byDay.set(i.dueShort, (byDay.get(i.dueShort) ?? 0) + 1);
  return {
    summary: `The next seven days — ${items.length} due across ${byDay.size} days, against ${state.dayBudget} hours a day and ${state.windows.length} working ${state.windows.length === 1 ? 'window' : 'windows'}.`,
    visible: [...byDay.entries()].map(([day, count]) => ({ day, due: count })),
    actions: ['add_task', 'start_timer', 'open_screen'],
    suggestions: [
      'Which is my heaviest day?',
      'Where is there room to move something?',
      'Is this week realistic?',
    ],
  };
};

/** When you are behind — what has gone by, and what still fits. */
export const behind: Provide = (look) => {
  const { state, catalog, now } = look;
  const missed = datedItems(catalog, now)
    .filter((i) => i.isPast && !state.done[i.id])
    .slice(-25)
    .map((i) => ({
      id: i.id,
      course: catalog.byId[i.c]?.code,
      title: i.title,
      wasDue: i.dueShort,
      daysAgo: Math.abs(i.daysAway),
      weight: i.weight,
    }));
  const short = catalog.courses
    .map((c) => {
      const t = tally(state.attendance, c.id);
      const policy = state.attendPolicy[c.id];
      if (!hasPolicy(policy) || t.marked === 0) return null;
      const b = budget(policy, t);
      return b.left <= 1 ? { course: catalog.byId[c.id].code, absencesLeft: b.left, pointsLost: b.cost } : null;
    })
    .filter(Boolean);
  return {
    summary: `Behind — ${missed.length} things gone by unticked${short.length > 0 ? `, and ${short.length} ${short.length === 1 ? 'course is' : 'courses are'} at or past the absence allowance` : ''}.`,
    visible: [...missed, ...short],
    actions: ['tick_deadline', 'add_task', 'open_screen'],
    suggestions: [
      'What is worth catching up and what is not?',
      'Which of these still affects my grade?',
      'What do I say to the professor?',
    ],
  };
};

/**
 * The degree — what is left of a major or a minor.
 *
 * The one screen in this group about years rather than weeks. Requirements
 * and what counts toward them, with the arithmetic already done by
 * `lib/degree.ts`, so the assistant is reading the same numbers the screen
 * prints rather than re-deriving them from courses.
 */
export const degree: Provide = (look) => {
  const { state } = look;
  if (state.requirements.length === 0) return null;
  const rows = state.requirements.map((r) => {
    const p = progress(r, state.taken);
    return {
      programme: r.programme,
      requirement: r.name,
      needs: `${r.count} ${r.need}`,
      have: p.have,
      inProgress: p.willHave - p.have,
      left: p.left,
      met: p.met || p.meetsAfter,
    };
  });
  const done = rows.filter((r) => r.met).length;
  return {
    summary: `The degree — ${rows.length} requirements tracked, ${done} met or met after this term. ${state.taken.length} courses recorded.`,
    visible: rows,
    actions: ['open_screen'],
    suggestions: [
      'What is left before I graduate?',
      'What should I take next term?',
      'Does anything I am taking now count twice?',
    ],
  };
};
