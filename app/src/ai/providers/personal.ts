import { DESTINATIONS } from '../../lib/nav';
import { datedItems } from '../../lib/select';
import { tally } from '../../lib/review';
import type { Provide } from '../shape';
import { guideNow } from '../shape';

/**
 * The three screens the registry keeps outside its groups.
 *
 * Personal, Progress and the between-classes mode. All three are about the
 * student rather than a course, which is what makes the one rule here worth
 * writing down twice: **note bodies never travel**. Personal is where the
 * notes live, and a provider that handed over "what is on screen" would send
 * the body of whatever note is open — which is the most private thing in this
 * app and the thing `lib/context.ts` refuses under any circumstance.
 *
 * So the note provider sends titles and lengths. "Summarise this note" is
 * then a question the assistant has to decline and say why, which is the
 * right outcome: the rule is worth more than the feature.
 */

/** Personal — your own tasks, appointments, notes and files. Saved places
 * live on the map, which is the one screen that has them. */
export const mine: Provide = (look) => {
  const { state, catalog } = look;
  // The tab decides what the screen is showing, and each shows something
  // different enough to need its own description. Tasks is the default and
  // the fallback: an unset tab is the tasks tab.
  const tab = state.mineTab;

  if (tab === 'notes') {
    return {
      summary: `Your notes — ${state.notes.length}. Titles only: what is written inside a note never leaves this device.`,
      visible: state.notes.slice(0, 30).map((n) => ({
        title: n.title,
        length: `${n.body.length} characters`,
        ...(n.courseId ? { course: catalog.byId[n.courseId]?.code } : {}),
        updated: new Date(n.updated).toDateString(),
      })),
      actions: ['add_note', 'open_screen'],
      suggestions: ['Which of these have I not touched in a while?', 'Help me start a note about this.'],
    };
  }

  if (tab === 'appointments') {
    return {
      summary: `Your appointments — ${state.appointments.length}.`,
      visible: state.appointments.slice(0, 30).map((a) => ({
        title: a.title,
        date: a.date,
        time: a.time,
        ...(a.where ? { where: a.where } : {}),
      })),
      actions: ['add_task', 'open_screen'],
      suggestions: ['What have I got on this week?', 'Does anything clash with a deadline?'],
    };
  }

  const undone = state.tasks.filter((t) => !t.done);
  return {
    summary: `Your own list — ${undone.length} undone of ${state.tasks.length}.`,
    visible: undone.slice(0, 30).map((t) => ({
      id: t.id,
      title: t.title,
      date: t.date ?? 'no date',
      ...(t.courseId ? { course: catalog.byId[t.courseId]?.code } : {}),
      ...(t.time ? { time: t.time } : {}),
    })),
    actions: ['add_task', 'move_task', 'open_screen'],
    suggestions: [
      'What should I do first?',
      'Move the ones I will not get to this week.',
      'What has been sitting here longest?',
    ],
  };
};

/**
 * Progress — how the studying itself is going.
 *
 * Counts and accuracy, never the answers. Which cards were got wrong is the
 * drill's business; what belongs here is whether the studying is working.
 */
export const me: Provide = (look) => {
  const { state, catalog, now } = look;
  const t = tally(state.reviews);
  const rows = catalog.courses.map((c) => {
    const guide = guideNow(look, c.id);
    const mastery = guide
      ? Math.round(guide.units.reduce((n, u) => n + u.mastery, 0) / Math.max(1, guide.units.length))
      : 0;
    return {
      course: catalog.byId[c.id].code,
      units: guide?.units.length ?? 0,
      averageMastery: `${mastery}%`,
      ahead: datedItems(catalog, now).filter((i) => i.c === c.id && !i.isPast).length,
    };
  });
  /*
   * What the directory knew, now that the directory is a tab of this screen.
   *
   * The registry itself is already in the system prompt — see `PICK.always` in
   * `lib/context.ts` — so naming fifty screens here would spend two thousand
   * tokens on what the model has been told twice. What it does not have is
   * which of them this student has opened, which is the one thing the
   * Everything screen's own provider sent and the one thing worth keeping.
   */
  const never = DESTINATIONS.filter((d) => !state.visited[d.screen]).map((d) => d.screen);
  return {
    summary:
      `Progress — ${t.cards} cards answered, ${t.pct}% right. ${state.spent.length} pieces of work timed, ${state.sittings.length} practice papers sat. ` +
      `The Everything tab is the directory: ${DESTINATIONS.length - never.length} of ${DESTINATIONS.length} screens have been opened at least once.`,
    visible: never.length > 0 ? [...rows, { neverOpened: never.join(', ') }] : rows,
    actions: ['open_screen'],
    suggestions: [
      'Is the studying actually working?',
      'Which course am I furthest behind on?',
      'What have I never opened that I should?',
    ],
  };
};

/**
 * The between-classes mode — a short gap, and what fits in it.
 *
 * The only screen whose context is a duration. What matters is what can be
 * finished in the time left, so the cards due and the shortest tasks travel
 * and nothing else does.
 */
export const gap: Provide = (look) => {
  const { state, catalog, now } = look;
  const soon = datedItems(catalog, now).filter((i) => !i.isPast && i.daysAway <= 3);
  const quick = state.tasks.filter((t) => !t.done).slice(0, 10);
  return {
    summary: `Between classes. ${soon.length} things due in the next three days, ${quick.length} undone tasks of your own.`,
    visible: [
      ...soon.slice(0, 10).map((i) => ({ course: catalog.byId[i.c]?.code, title: i.title, due: i.dueShort })),
      ...quick.map((t) => ({ task: t.title, date: t.date ?? 'no date' })),
    ],
    actions: ['start_timer', 'tick_deadline', 'open_screen'],
    suggestions: [
      'What can I actually finish in twenty minutes?',
      'Is it worth starting anything, or should I just drill?',
    ],
  };
};
