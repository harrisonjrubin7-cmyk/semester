import { forTerm as balancesFor, pace } from '../../lib/meals';
import { forTerm as costsFor, money, total } from '../../lib/cost';
import { aidKindOf, billFor, chargeKindOf, forTerm as billRowsFor } from '../../lib/bill';
import { codeOf } from '../../lib/call';
import { dateToIso } from '../../lib/date';
import { byDateThenTime } from '../../lib/select';
import { UNIVERSITY_AREAS } from '@semester/institution';
import { gatewayConfigured } from '../../lib/university';
import type { Provide } from '../shape';

/**
 * The Campus group — the parts of university that are not coursework.
 *
 * Two of these hold money and one holds a room, which is why none of them
 * carries an account number, a card number or a door code even where the app
 * has one. What the assistant needs to answer "will my meal plan last" is
 * the balance and the burn rate, not the credential behind them.
 */

/**
 * Money — the statement and the aid against it, and what you paid yourself.
 *
 * Both halves of the screen, and `visible` follows the tab the student is
 * actually on, because that is what `visible` means here. The other half is
 * still summarised in one line, so "how much do I owe" answers from the
 * out-of-pocket tab rather than saying it cannot see the bill.
 *
 * ## The two figures stay two figures
 *
 * `owed` and `if_pending_aid_lands` are handed over as separate fields with
 * those names. Collapsing them into one would have the assistant quote a
 * balance that is not owed — the same refusal `lib/bill.ts` is built around,
 * and the one place in the app where a model could undo it by averaging.
 */
export const costs: Provide = (look) => {
  const { state, catalog, now } = look;
  const mine = costsFor(state.costs, state.term);
  const t = total(mine);
  const bill = billFor(state, state.term, now);
  const onBill = state.costsTab === 'bill';

  const outLine =
    mine.length === 0
      ? `nothing recorded out of pocket for ${state.term}`
      : `${money(t.net)} out of pocket across ${t.items} entries`;

  const billLine = !bill.any
    ? 'no statement entered'
    : `${money(bill.owed.owedCents)} owed on ${money(bill.owed.chargesCents)} charged, ${money(bill.owed.creditedCents)} covered by confirmed aid`;

  const figures = bill.any
    ? {
        charged: money(bill.owed.chargesCents),
        covered_by_confirmed_aid: money(bill.owed.creditedCents),
        owed: money(bill.owed.owedCents),
        // Deliberately a separate field with this name. It is not a balance.
        ...(bill.owed.pendingCents > 0
          ? {
              unconfirmed_aid: money(bill.owed.pendingCents),
              if_pending_aid_lands: money(Math.max(0, bill.owed.bestCaseCents)),
            }
          : {}),
        ...(bill.owed.earnedCents > 0
          ? { work_study_paid_to_you_not_the_bill: money(bill.owed.earnedCents) }
          : {}),
        ...(bill.owed.borrowedCents > 0 ? { of_that_borrowed: money(bill.owed.borrowedCents) } : {}),
        ...(bill.paidCents > 0 ? { paid_so_far: money(bill.paidCents) } : {}),
        ...(bill.next
          ? {
              next_payment: money(bill.next.shortCents),
              next_payment_due: bill.next.instalment.due,
              ...(bill.next.overdue ? { overdue: true } : {}),
            }
          : {}),
      }
    : undefined;

  return {
    summary: `Money, ${state.term} — ${billLine}; ${outLine}.`,
    ...(figures ? { focus: figures } : {}),
    visible: onBill
      ? [
          ...billRowsFor(state.charges, state.term).map((c) => ({
            row: 'charge',
            what: c.what,
            kind: chargeKindOf(c.kind).label,
            amount: money(c.cents),
          })),
          ...billRowsFor(state.aid, state.term).map((a) => ({
            row: 'aid',
            what: a.what,
            kind: aidKindOf(a.kind).label,
            amount: money(a.cents),
            confirmed: !a.pending,
            credited_against_the_bill: aidKindOf(a.kind).credits,
          })),
          ...billRowsFor(state.payments, state.term).map((p) => ({
            row: 'payment',
            what: p.what,
            amount: money(p.cents),
            on: p.on,
          })),
        ].slice(0, 40)
      : mine.slice(0, 30).map((c) => ({
          what: c.what,
          kind: c.kind,
          cost: money(c.cents),
          ...(c.rented ? { rented: true } : {}),
          ...(c.backCents ? { came_back: money(c.backCents) } : {}),
          ...(c.courseId ? { course: catalog.byId[c.courseId]?.code } : {}),
        })),
    actions: ['open_screen'],
    suggestions: onBill
      ? [
          'How much do I actually owe right now?',
          'What is my next payment and when is it due?',
          'How much of my aid is borrowed?',
        ]
      : [
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

/**
 * A call — what is booked, and the code for it.
 *
 * Nothing about a call in progress: the assistant is not in the call, nobody
 * in it agreed to be described to a model, and the chat inside one is never
 * saved unless somebody chooses to keep it. What is here is the diary — the
 * calls that are booked are ordinary appointments, and an appointment is
 * already something the student asked the app to hold.
 */
export const call: Provide = (look) => {
  const { state, now } = look;
  const iso = dateToIso(now);
  const booked = state.appointments
    .filter((a) => codeOf(a) && a.date >= iso)
    .sort(byDateThenTime);
  return {
    summary:
      booked.length === 0
        ? 'Video call — nothing booked. A call can be started now, or scheduled into the calendar.'
        : `Video call — ${booked.length} booked, the next on ${booked[0].date} at ${booked[0].time}.`,
    visible: booked.slice(0, 10).map((a) => ({
      title: a.title,
      date: a.date,
      time: a.time,
      code: codeOf(a),
    })),
    actions: ['open_screen'],
    suggestions: [
      'When is my next study call?',
      'What should we cover on the call?',
    ],
  };
};

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

/**
 * The university — and, above all, what it cannot do.
 *
 * The most important field this provider hands over is the one saying nothing
 * is connected. Without it the assistant, asked "register me for ECON 2100"
 * on a screen headed *Course registration*, has every reason to believe that
 * is a thing this app does. It is not, and a confident yes there costs
 * somebody a class.
 *
 * So the summary leads with the limit, `focus` states it as data rather than
 * prose, and no draft text is handed over at all: drafts live in
 * `localStorage` under `screens/University.tsx`, they are appeals and advising
 * notes, and they are none of the assistant's business unless somebody pastes
 * one in.
 */
export const university: Provide = () => {
  const areas = UNIVERSITY_AREAS.length;
  const connected = gatewayConfigured
    ? 'A gateway address is configured, but no service has been verified for this account yet.'
    : 'No university gateway is configured, so no official service is reachable.';
  return {
    summary: `University — ${areas} service areas. ${connected} This app can prepare drafts and plans for them; it cannot submit, enrol, pay or fetch official records.`,
    focus: {
      service_areas: areas,
      gateway_configured: gatewayConfigured,
      official_actions_available: false,
      can_do_here: 'preparation drafts, checklists, and opening the local screens that already exist',
    },
    visible: [],
    actions: ['open_screen'],
    suggestions: [
      'What should I ask my advisor before registration opens?',
      'Help me prepare a draft for a grade appeal.',
    ],
  };
};

/**
 * Athletics — the season, and what it costs academically.
 *
 * The events themselves live in a device library this provider cannot reach,
 * so what it hands over is the commitments the term already records and the
 * one thing the assistant must not get wrong: an absence is something an
 * athletics office authorizes, and nothing here has authorized one.
 */
export const athletics: Provide = (look) => {
  const { state } = look;
  const teams = state.commitments.filter((c) => c.kind === 'varsity');
  return {
    summary: `Athletics — ${teams.length} varsity commitments recorded this term. Practices, training and travel are planned on this device; this app cannot authorize an absence or verify eligibility.`,
    focus: {
      varsity_commitments: teams.length,
      can_authorize_absence: false,
      absence_letters_are: 'drafts for the student to review and send themselves',
    },
    visible: teams.slice(0, 25).map((c) => ({ name: c.name, role: c.role })),
    actions: ['open_screen', 'add_task'],
    suggestions: [
      'What should I sort out before a four-day away trip?',
      'Help me word an absence request to a professor.',
    ],
  };
};

/** Career — what is being applied for, and what stage each one is at. */
export const career: Provide = (look) => {
  const { state } = look;
  const live = state.applications.filter((a) => a.stage !== 'closed');
  return {
    summary: `Career — ${live.length} live applications. Opportunities and résumé entries are the student's own records, not verified listings, and nothing here submits an application.`,
    focus: { live_applications: live.length, submits_applications: false },
    visible: live.slice(0, 25).map((a) => ({ org: a.org, role: a.role, stage: a.stage, due: a.due })),
    actions: ['open_screen', 'add_task'],
    suggestions: [
      'Which application deadline is closest?',
      'What should go in a cover letter for this one?',
    ],
  };
};

/**
 * Pathway — the arc past this term.
 *
 * Deliberately thin. The programmes, costs and milestones are in a device
 * library, and the one thing worth saying is the thing a status here does not
 * mean: nothing on that screen enrols anybody or reflects a decision an
 * institution has made.
 */
export const pathway: Provide = () => ({
  summary:
    'Pathway — applications, arrival, research milestones and graduation, planned on this device. Every stage and status is what the student believes is happening, not an institutional record, and cost figures are their own estimates.',
  focus: { statuses_are: 'self-reported', changes_enrollment: false, costs_are: 'student estimates, loans not counted as aid' },
  visible: [],
  actions: ['open_screen'],
  suggestions: [
    'What should I have ready before a graduate application deadline?',
    'Help me compare two programs on the same assumptions.',
  ],
});

/**
 * Family — and the one provider that deliberately hands over nothing.
 *
 * The plans, the selected items and the preview are exactly the material a
 * student chose to share with one specific person, and handing them to a
 * model is a second disclosure they did not choose. So `visible` is empty and
 * stays empty. What the assistant gets is what the screen is for, which is
 * enough to answer a question about how to use it.
 */
export const family: Provide = () => ({
  summary:
    'Family — a plan for what one person would be shown, prepared on this device. It grants no access to anybody, sends no invitation, and the items in it are private to the student.',
  focus: { grants_access: false, sends_invitations: false, items_shared_with_assistant: false },
  visible: [],
  actions: ['open_screen'],
  suggestions: [
    'What should I share with a parent helping me with the bill?',
    'How do I set an expiry on what someone can see?',
  ],
});

/**
 * Create — what the student has made, and what this screen can start.
 *
 * The forms, designs and videos are in a device library out of reach here, so
 * what goes over is the makers the term already holds. The useful thing for
 * the assistant to know is that this screen *starts* things rather than being
 * a thing: asked "help me make a poster", the right answer names the tile.
 */
export const create: Provide = (look) => {
  const { state } = look;
  const made = state.documents.length + state.sheets.length + state.decks.length;
  return {
    summary: `Create — one door to the makers. ${made} documents, sheets and decks so far, plus forms, designs and videos kept on this device.`,
    focus: {
      documents: state.documents.length,
      sheets: state.sheets.length,
      decks: state.decks.length,
      also_makes: 'forms, designs and videos, stored on this device only',
    },
    visible: [],
    actions: ['open_screen'],
    suggestions: ['Help me start a poster for this assignment.', 'What should go on each slide?'],
  };
};
