import { datedItems } from '../../lib/select';
import { daysTo, filled, sheet } from '../../lib/registrar';
import type { Look, Provide } from '../shape';
import { chipped, worked } from './core';
import { weekly } from './upkeep';

/**
 * The Semester group — what is happening and when.
 *
 * Everything here is built from the syllabi, so every provider in this file
 * hands over dates, weights and titles rather than anything the student typed
 * about themselves. That is also why none of them carries a quote: the app
 * shows the sentence a date was read from on the screen itself, and a quote
 * in a context window is a quote nobody can check against the file.
 */

/** Deadlines in a window, after the chip, in the shape every provider uses. */
function due(look: Look, days: number, cap = 40) {
  const { state, catalog, now } = look;
  const only = chipped(look);
  return datedItems(catalog, now)
    .filter((i) => !i.isPast && i.daysAway <= days)
    .filter((i) => only.some((c) => c.id === i.c))
    .slice(0, cap)
    .map((i) => ({
      id: i.id,
      course: catalog.byId[i.c]?.code,
      title: i.title,
      due: i.dueShort,
      inDays: i.daysAway,
      ...(i.weight ? { weight: i.weight } : {}),
      ...(state.done[i.id] ? { done: true } : {}),
    }));
}

/**
 * Today — what is due, what is next, tonight's plan.
 *
 * The one screen where the feed chip is the student's own filter rather than
 * a leftover, so it is honoured: filtering to ECON and asking "how many are
 * there" has to answer about ECON.
 */
export const home: Provide = (look) => {
  const { catalog } = look;
  if (catalog.empty) return null;
  const rows = due(look, 8);
  const only = chipped(look);
  const filtered = only.length < catalog.courses.length;
  return {
    summary:
      `Today — the next eight days` +
      (filtered ? `, filtered to ${only.map((c) => catalog.byId[c.id].code).join(' and ')}` : '') +
      `. ${rows.length} ahead, ${rows.filter((r) => r.done).length} already ticked off.`,
    visible: rows,
    actions: ['tick_deadline', 'add_task', 'start_timer', 'open_screen'],
    suggestions: [
      'What should I start with today?',
      'What is due before the weekend?',
      'How long will all of this take?',
    ],
  };
};

/**
 * The report — the same window as Today, read as a report rather than a list.
 *
 * Three grains behind one screen, so three readings behind one provider: an
 * assistant told "you are looking at your day" while the term report is on
 * screen is an assistant looking at the wrong thing. See `screens/Reports.tsx`.
 */
export const brief: Provide = (look) => {
  const { catalog, now } = look;
  if (look.state.report === 'week') return weekly(look);
  if (look.state.report === 'term') return worked(look);
  if (catalog.empty) return null;
  const rows = due(look, 2);
  const overdue = datedItems(catalog, now).filter((i) => i.isPast && !look.state.done[i.id]).length;
  return {
    summary: `Your day — ${rows.length} due today or tomorrow, ${overdue} overdue across the semester.`,
    visible: rows,
    actions: ['tick_deadline', 'add_task', 'open_screen'],
    suggestions: [
      'What is the one thing I should not let slip today?',
      'What went by that I have not dealt with?',
    ],
  };
};

/**
 * Term deadlines — the registrar's dates, not a course's.
 *
 * Add/drop, withdrawal, registration. These are the dates with no second
 * chance, which is why the provider carries what each one costs when it has
 * a cost: "the drop deadline" and "the drop deadline, after which it is a W
 * and $0" are different answers.
 */
export const registrar: Provide = (look) => {
  const { state, now } = look;
  // `sheet` fills in the shipped dates a student has not overwritten;
  // `filled` drops the rows with no date, which is what the screen shows.
  const dates = filled(sheet(state.registrar))
    .map((d) => {
      const days = daysTo(d.iso, now);
      return {
        what: d.label,
        date: d.iso,
        ...(d.until ? { until: d.until } : {}),
        ...(d.cost ? { cost: d.cost } : {}),
        inDays: days,
        ...(days < 0 ? { passed: true } : {}),
      };
    })
    .slice(0, 30);
  if (dates.length === 0) return null;
  const ahead = dates.filter((d) => !d.passed).length;
  return {
    summary: `Term deadlines for ${state.term} — ${dates.length} dates, ${ahead} still ahead.`,
    visible: dates,
    actions: ['open_screen', 'add_task'],
    suggestions: [
      'What is the last day I can drop something?',
      'Which of these is closest?',
      'What does withdrawing cost me?',
    ],
  };
};
