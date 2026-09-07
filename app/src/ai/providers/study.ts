import { datedItems } from '../../lib/select';
import { cardKey, dueCount } from '../../lib/review';
import type { Provide } from '../shape';
import { pct } from './core';

/**
 * The Study group — turning what a course holds into something testable.
 *
 * Every provider here describes the *shape* of the material rather than the
 * material: unit names, card counts, how cold each one is. The cards
 * themselves are the thing the question is usually a shortcut past, and
 * `lib/context.ts` already decides when they may travel — a screen provider
 * handing them over would be a second door to the same data, past the
 * allowlist. See that file's header.
 */

/** The open course, with its guide, or nothing. */
function open(look: Parameters<Provide>[0]) {
  const course = look.catalog.byId[look.state.guideId];
  const guide = look.catalog.guides[look.state.guideId];
  return course && guide ? { course, guide } : null;
}

/** Ask Claude — the screen this whole feature is replacing. */
export const ask: Provide = (look) => {
  const it = open(look);
  if (!it) return null;
  return {
    summary: `The Ask screen, scoped to ${it.course.code}. This is the older, single-course version of the assistant.`,
    focus: { course: it.course.code },
    visible: [],
    actions: ['open_screen'],
    suggestions: [`Explain the coldest unit in ${it.course.code}.`, 'What should I revise first?'],
  };
};

/** Work on it — an assignment broken into a rubric and a plan. */
export const work: Provide = (look) => {
  const it = open(look);
  const { catalog, now, state } = look;
  const soon = datedItems(catalog, now)
    .filter((i) => !i.isPast && !state.done[i.id] && (!it || i.c === it.course.id))
    .slice(0, 8)
    .map((i) => ({ id: i.id, course: catalog.byId[i.c]?.code, title: i.title, due: i.dueShort, weight: i.weight }));
  return {
    summary: it
      ? `Breaking down an assignment for ${it.course.code}. ${soon.length} of its deadlines are still ahead.`
      : 'Breaking down an assignment. No course is open.',
    visible: soon,
    actions: ['add_task', 'start_timer', 'open_screen'],
    suggestions: [
      'How should I split this across the days I have?',
      'What is this rubric actually asking for?',
    ],
  };
};

/** Add a reading — material in, and every study mode picks it up. */
export const update: Provide = (look) => {
  const it = open(look);
  if (!it) return null;
  const mine = look.state.updates.filter((u) => u.courseId === it.course.id);
  return {
    summary: `Adding material to ${it.course.code} — ${it.guide.units.length} units already, ${mine.length} things imported before.`,
    focus: { course: it.course.code, units: it.guide.units.map((u) => u.name) },
    visible: mine.slice(-10).map((u) => ({
      title: u.title,
      unit: u.unit ?? 'unfiled',
      cards: u.cards?.length ?? 0,
      ...(u.source ? { from: u.source } : {}),
    })),
    actions: ['open_screen'],
    suggestions: ['Which unit should this go under?', 'What is missing from this course?'],
  };
};

/** Analyse data — a CSV in, statistics out. Nothing of the data travels. */
export const analyse: Provide = () => ({
  summary:
    'Analysing a data file. The file itself is read in this browser and never sent — what leaves is only what you ask about it.',
  visible: [],
  actions: ['open_screen'],
  suggestions: ['Which test fits this design?', 'How do I read this output?'],
});

/** Work the problem — the method, worked on other numbers. */
export const solve: Provide = (look) => {
  const it = open(look);
  return {
    summary: it
      ? `Working a problem in ${it.course.code}, method first.`
      : 'Working a problem. No course is open.',
    visible: [],
    actions: ['start_timer', 'open_screen'],
    suggestions: ['Where did I go wrong?', 'Work this same method on different numbers.'],
  };
};

/**
 * Practice paper — the papers sat, and what they cost.
 *
 * Scores travel because they are the student's own record of a mock, not a
 * grade the course gave; the projection screens read them separately and the
 * assistant has no tool that can change either.
 */
export const exam: Provide = (look) => {
  const { state, catalog } = look;
  const sittings = state.sittings.slice(-12).map((s) => ({
    course: catalog.byId[s.courseId]?.code ?? s.courseId,
    paper: s.title,
    scored: `${s.got}/${s.outOf} (${s.pct}%)`,
    minutes: s.minutes,
    missed: s.missed.length,
  }));
  const best = sittings.length > 0 ? Math.max(...state.sittings.map((s) => s.pct)) : 0;
  return {
    summary:
      `Practice papers — ${state.sittings.length} sat` +
      (state.sittings.length > 0 ? `, best ${best}%` : '') +
      '. These are your own mocks, not marks any course gave.',
    visible: sittings,
    actions: ['start_timer', 'open_screen'],
    suggestions: [
      'What am I losing marks on across these?',
      'Set me a paper on what I am weakest at.',
    ],
  };
};

/** Exam runway — the weeks before an exam, counted backwards. */
export const runway: Provide = (look) => {
  const { state, catalog, now } = look;
  const exams = datedItems(catalog, now)
    .filter((i) => !i.isPast && /exam|final|midterm/i.test(i.title))
    .slice(0, 8)
    .map((i) => ({
      course: catalog.byId[i.c]?.code,
      what: i.title,
      date: i.dueShort,
      inDays: i.daysAway,
      weight: i.weight,
      ...(catalog.guides[i.c]
        ? { unitsToCover: catalog.guides[i.c].units.length, coldest: coldest(catalog.guides[i.c]) }
        : {}),
    }));
  if (exams.length === 0) return null;
  return {
    summary: `The runway to ${exams.length} ${exams.length === 1 ? 'exam' : 'exams'}, nearest in ${exams[0].inDays} days. ${state.dayBudget} hours a day is what you have told the app you have.`,
    focus: exams[0],
    visible: exams,
    actions: ['start_timer', 'add_task', 'open_screen'],
    suggestions: [
      'What should the next week look like?',
      'Am I going to run out of time?',
      'Which unit is costing me the most?',
    ],
  };
};

/** The unit with the least mastery, named. */
function coldest(guide: { units: { name: string; mastery: number }[] }): string {
  const cold = [...guide.units].sort((a, b) => a.mastery - b.mastery)[0];
  return cold ? `${cold.name} (${cold.mastery}%)` : '';
}

/**
 * Tonight — how long you have, and where the hours buy most.
 *
 * The one screen whose whole point is a budget, so the budget is the summary
 * rather than a row. Cards due travel as a count: what to drill is a question
 * about which unit, not which card.
 */
export const tonight: Provide = (look) => {
  const { state, catalog, now } = look;
  const rows = catalog.courses.map((c) => {
    const guide = catalog.guides[c.id];
    // The same count the drill uses, from the same keys — a card is due when
    // it has never been seen or its interval has run out. See `lib/review.ts`.
    const ready = guide
      ? dueCount(
          guide.units.flatMap((u) => u.cards.map((card) => cardKey(c.id, card.q))),
          state.reviews,
          now.getTime(),
        )
      : 0;
    const next = datedItems(catalog, now).find((i) => i.c === c.id && !i.isPast);
    return {
      course: catalog.byId[c.id].code,
      cardsDue: ready,
      coldest: guide ? coldest(guide) : '',
      ...(next ? { nextDeadline: `${next.title}, ${next.dueShort}` } : {}),
    };
  });
  return {
    summary: `Tonight — ${state.dayBudget} hours budgeted. ${rows.reduce((n, r) => n + r.cardsDue, 0)} cards are due across ${rows.length} courses.`,
    visible: rows,
    actions: ['start_timer', 'open_screen'],
    suggestions: [
      'What should I drill first tonight?',
      'Is two hours enough for what is due?',
      'Which course have I been ignoring?',
    ],
  };
};

/** Study's own screen already has a provider; this is the drill under it. */
export const drillLike: Provide = (look) => {
  const it = open(look);
  if (!it) return null;
  const unit = it.guide.units[look.state.drillUnit ?? look.state.openUnit ?? 0];
  return {
    summary: `Drilling ${it.course.code}${unit ? ` — ${unit.name}, ${pct(unit.mastery)} mastered` : ''}.`,
    focus: unit ? { unit: unit.name, cards: unit.cards.length, mastery: unit.mastery } : undefined,
    visible: it.guide.units.map((u) => ({ name: u.name, cards: u.cards.length, mastered: `${u.mastery}%` })),
    actions: ['start_timer', 'open_screen'],
    suggestions: ['Explain the one I keep getting wrong.', 'Which unit should I do next?'],
  };
};
