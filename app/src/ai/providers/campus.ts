import { forTerm as balancesFor, pace } from '../../lib/meals';
import { forTerm as costsFor, money, total } from '../../lib/cost';
import type { Provide } from '../shape';

/**
 * The Campus group — the parts of university that are not coursework.
 *
 * Two of these hold money and one holds a room, which is why none of them
 * carries an account number, a card number or a door code even where the app
 * has one. What the assistant needs to answer "will my meal plan last" is
 * the balance and the burn rate, not the credential behind them.
 */

/** What this term cost — books, fees, access codes, and what came back. */
export const costs: Provide = (look) => {
  const { state, catalog } = look;
  const mine = costsFor(state.costs, state.term);
  if (mine.length === 0) {
    return {
      summary: `What this term cost — nothing recorded yet for ${state.term}.`,
      visible: [],
      actions: ['open_screen'],
      suggestions: ['What should I be keeping receipts for?'],
    };
  }
  const t = total(mine);
  return {
    summary: `${state.term} cost so far — ${money(t.spent)} spent, ${money(t.back)} back, ${money(t.net)} net across ${t.items} entries.`,
    visible: mine.slice(0, 30).map((c) => ({
      what: c.what,
      kind: c.kind,
      cost: money(c.cents),
      ...(c.rented ? { rented: true } : {}),
      ...(c.backCents ? { came_back: money(c.backCents) } : {}),
      ...(c.courseId ? { course: catalog.byId[c.courseId]?.code } : {}),
    })),
    actions: ['open_screen'],
    suggestions: [
      'Which course cost me the most?',
      'What is still worth selling back?',
      'How does this compare to what I expected?',
    ],
  };
};

/**
 * Meal plan — what is on it, what it is a day, and when it runs out.
 *
 * The burn rate is the number the screen exists for, so it is in the
 * summary rather than left to be derived from two balances.
 */
export const meals: Provide = (look) => {
  const { state, now } = look;
  const forThis = balancesFor(state.balances, state.term);
  const last = forThis[forThis.length - 1];
  if (!last) {
    return {
      summary: 'Meal plan — no balance recorded yet.',
      visible: [],
      actions: ['open_screen'],
      suggestions: ['How do I check my balance?'],
    };
  }
  /*
   * The burn rate, from the same function the screen prints.
   *
   * `pace` needs two readings far enough apart to mean something — one heavy
   * Saturday is not a habit — and says so with `known`. An unknown rate is
   * left out rather than shown as zero, which would read as "you are
   * spending nothing".
   */
  const p = pace(forThis, null, now);
  return {
    summary:
      `Meal plan as at ${new Date(last.at).toDateString()} — ${last.swipes} swipes, ` +
      `${money(last.diningCents)} dining, ${money(last.cashCents)} Commodore Cash.` +
      (p.known ? ` About ${p.rate.toFixed(1)} swipes a day.` : ' Not enough readings yet to say how fast it is going.'),
    focus: { swipes: last.swipes, dining: money(last.diningCents), cash: money(last.cashCents) },
    visible: forThis
      .slice(-10)
      .map((b) => ({
        on: new Date(b.at).toDateString(),
        swipes: b.swipes,
        dining: money(b.diningCents),
        cash: money(b.cashCents),
      })),
    actions: ['open_screen'],
    suggestions: [
      'Will this last the term?',
      'How much can I spend a week from here?',
      'Am I burning swipes faster than I should?',
    ],
  };
};

/** Housing — the room, and the move-out date counted from the last exam. */
export const housing: Provide = (look) => {
  const { state } = look;
  const here = state.residences.find((r) => r.term === state.term);
  if (!here) return null;
  return {
    summary: `Housing — ${here.hall} ${here.room}, move-out ${here.moveOut || 'not set'}.`,
    focus: { hall: here.hall, room: here.room, moveOut: here.moveOut },
    visible: [],
    actions: ['open_screen', 'add_task'],
    suggestions: [
      'How long after my last exam do I have to be out?',
      'What do I need to do before move-out?',
    ],
  };
};

/** Group work — the shared list for a project, and who has which part. */
export const groupwork: Provide = (look) => {
  const { state, catalog } = look;
  const mine = state.tasks.filter((t) => !t.done && t.courseId);
  return {
    summary: `Group work — ${mine.length} of your own undone tasks are filed against a course.`,
    visible: mine.slice(0, 25).map((t) => ({
      id: t.id,
      title: t.title,
      course: t.courseId ? catalog.byId[t.courseId]?.code : undefined,
      date: t.date ?? 'no date',
    })),
    actions: ['add_task', 'move_task', 'open_screen'],
    suggestions: [
      'What is my part of this, and when is it due?',
      'What should I chase somebody about?',
    ],
  };
};

/** Getting there — a map, and where classes actually are. */
export const maps: Provide = (look) => {
  const { catalog } = look;
  const rooms = catalog.courses
    .map((c) => ({ course: catalog.byId[c.id].code, room: catalog.byId[c.id].room, meets: catalog.byId[c.id].meets }))
    .filter((r) => r.room);
  return {
    summary: `The map. ${rooms.length} of your courses have a room recorded.`,
    visible: rooms,
    actions: ['open_screen'],
    suggestions: ['Where is my next class?', 'How long between these two buildings?'],
  };
};

/**
 * Email — the message you have been putting off.
 *
 * Names of professors are on this screen and are deliberately not handed
 * over: `lib/context.ts` never sends anything from `people`, and a provider
 * that did would be a second door past that rule. The course and the
 * deadline are enough to draft about.
 */
export const mail: Provide = (look) => {
  const { catalog, state } = look;
  const course = catalog.byId[state.courseId || state.guideId];
  return {
    summary: course
      ? `Drafting an email about ${course.code}. Names and addresses stay on this device.`
      : 'Drafting an email. Names and addresses stay on this device.',
    visible: [],
    actions: ['open_screen'],
    suggestions: [
      'How do I ask for an extension without making excuses?',
      'Is this too long?',
      'What should the subject line be?',
    ],
  };
};

/** Registration — class search, and the schedule you pasted. */
export const yes: Provide = (look) => ({
  summary: `Registration for the term after ${look.state.term}. Nothing here is submitted by the app — it opens the registrar's own site.`,
  visible: [],
  actions: ['open_screen'],
  suggestions: ['What do I still need to take?', 'Does this schedule clash?'],
});

/** Classmates — a room per class, for everyone at your school taking it. */
export const classmates: Provide = (look) => ({
  summary: `Classmates — a room per class. ${look.catalog.courses.length} of your courses have one.`,
  visible: look.catalog.courses.map((c) => ({ course: look.catalog.byId[c.id].code })),
  actions: ['open_screen'],
  suggestions: ['What is worth asking a classmate rather than the professor?'],
});

/** Activities — clubs, a job, research, a team, and what the week costs. */
export const activities: Provide = (look) => {
  const { state } = look;
  const live = state.commitments.filter((c) => c.active);
  if (live.length === 0) return null;
  const hours = live.reduce((n, c) => n + c.hours, 0);
  return {
    summary: `Activities — ${live.length} running, about ${hours} hours a week between them.`,
    visible: live.map((c) => ({
      name: c.name,
      kind: c.kind,
      role: c.role,
      hoursAWeek: c.hours,
      days: c.days.length,
    })),
    actions: ['add_task', 'open_screen'],
    suggestions: [
      'Is this too much alongside my courses?',
      'Which of these takes the most time?',
      'Where does this collide with my deadlines?',
    ],
  };
};

/** Links — campus sites, the bookstore, tickets. */
export const links: Provide = (look) => ({
  summary: `Campus links — ${look.state.extraLinks.length} you have added of your own.`,
  visible: look.state.extraLinks.slice(0, 25).map((l) => ({ name: l.name, group: l.group ?? 'Campus' })),
  actions: ['open_screen'],
  suggestions: ['Where do I go for this?'],
});
