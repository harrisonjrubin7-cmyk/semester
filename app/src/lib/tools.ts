/**
 * The few things Claude may offer to do, and nothing else.
 *
 * Ask has been text in, text out. It could tell you Problem Set 4 is due
 * Friday and could not tick it off; every answer ended with you doing by hand
 * the thing it had just described.
 *
 * ## Proposed, never done
 *
 * Nothing in this file executes anything. A tool call becomes a *proposal* —
 * one line saying exactly what would happen, with a button — and the student
 * decides. An assistant that can quietly edit a semester is a worse thing than
 * one that cannot, and the entire difference is the confirmation step.
 *
 * That is also why the list is short and every entry is reversible or
 * navigational. There is no tool for deleting a course, editing a grade or
 * spending money, and there should not be: the cost of the model getting one
 * of those wrong is not worth the convenience of it getting them right.
 *
 * ## Narrow arguments
 *
 * Every tool takes an id or a string the student can read back, never a
 * free-form patch. A tool whose argument is "the change to make" is a tool
 * whose confirmation line cannot be written honestly, because nobody can say
 * in advance what it will do.
 */

import type { ToolCall, ToolSpec } from './claude';
import type { Action } from '../state/shape';
import type { Screen } from './types';

/** The screens a proposal may send you to. Everything else is out of bounds. */
const REACHABLE: Screen[] = [
  'home',
  'courses',
  'study',
  'calendar',
  'mine',
  'me',
  'runway',
  'ahead',
  'weekly',
  'drill',
  'exam',
  'registrar',
  'costs',
  'housing',
  'meals',
  'groupwork',
  'gap',
];

export const TOOLS: ToolSpec[] = [
  {
    name: 'tick_deadline',
    description:
      'Mark a deadline as done, by its id. Only for a deadline the student has told you they finished. Never guess an id — if you are not sure which one they mean, ask instead.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The deadline id, exactly as given in the context.' },
        title: { type: 'string', description: 'Its title, so the student can check you meant it.' },
      },
      required: ['id', 'title'],
    },
  },
  {
    name: 'add_task',
    description:
      "Add something to the student's own list. For things they mention needing to do that are not on any syllabus.",
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What to do, in the student’s own words.' },
        date: { type: 'string', description: 'ISO date (2026-09-14), or empty for no date.' },
      },
      required: ['title', 'date'],
    },
  },
  {
    name: 'open_screen',
    description:
      'Take the student to a screen in the app, when the answer to their question lives there. Prefer this over describing where to tap.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        screen: {
          type: 'string',
          enum: REACHABLE,
          description: 'Which screen.',
        },
        why: { type: 'string', description: 'One short clause: what they will find there.' },
      },
      required: ['screen', 'why'],
    },
  },
];

/** A proposal, checked and ready to show. */
export interface Proposal {
  id: string;
  /** What the button will do, in the student's language. */
  said: string;
  /** The word on the button. */
  verb: string;
  action: Action;
}

function str(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Turn a tool call into something showable, or nothing.
 *
 * Every call is re-checked here against what the app actually holds, because
 * a tool argument is the model's belief and not a fact: an id it invented, a
 * screen that does not exist, an empty title. A proposal that cannot be
 * described exactly is not shown at all — silence is better than a button
 * whose label is a guess.
 */
export function readProposal(
  call: ToolCall,
  known: { deadlines: { id: string; title: string }[] },
): Proposal | null {
  if (call.name === 'tick_deadline') {
    const id = str(call.input, 'id');
    // The id has to be one the app holds. Otherwise the button would tick
    // nothing and report success.
    const real = known.deadlines.find((d) => d.id === id);
    if (!real) return null;
    return {
      id: call.id,
      said: `Tick off “${real.title}” as done`,
      verb: 'Tick it',
      action: { type: 'toggleDone', id },
    };
  }

  if (call.name === 'add_task') {
    const title = str(call.input, 'title');
    if (!title) return null;
    const date = str(call.input, 'date');
    const when = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
    return {
      id: call.id,
      said: when ? `Add “${title}” to your list for ${when}` : `Add “${title}” to your list`,
      verb: 'Add it',
      action: {
        type: 'addTask',
        task: { title, date: when || null, time: '', note: '', courseId: null },
      },
    };
  }

  if (call.name === 'open_screen') {
    const screen = str(call.input, 'screen') as Screen;
    if (!REACHABLE.includes(screen)) return null;
    const why = str(call.input, 'why');
    return {
      id: call.id,
      said: why ? `Open ${label(screen)} — ${why}` : `Open ${label(screen)}`,
      verb: 'Open it',
      action: { type: 'go', screen },
    };
  }

  return null;
}

/** What a screen is called, for a sentence rather than a route. */
function label(screen: Screen): string {
  const named: Partial<Record<Screen, string>> = {
    home: 'Today',
    courses: 'Courses',
    study: 'Study',
    calendar: 'the calendar',
    mine: 'your own list',
    me: 'Me',
    runway: 'the exam runway',
    ahead: 'the week ahead',
    weekly: 'this week',
    drill: 'the drill',
    exam: 'a practice paper',
    registrar: 'term deadlines',
    costs: 'what this term cost',
    housing: 'Housing',
    meals: 'the meal plan',
    groupwork: 'group work',
    gap: 'the between-classes mode',
  };
  return named[screen] ?? screen;
}

/**
 * The line above a set of proposals.
 *
 * Says that nothing has happened yet, because the whole arrangement depends on
 * the student believing that — and one ambiguous moment where they think the
 * app has already acted is enough to lose it.
 */
export function proposalsLine(list: Proposal[]): string {
  if (list.length === 0) return '';
  return list.length === 1
    ? 'It can do this for you — nothing has happened yet:'
    : `It can do these for you — nothing has happened yet:`;
}
