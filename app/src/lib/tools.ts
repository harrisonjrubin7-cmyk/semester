/**
 * The things Claude may offer to do, and nothing else.
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
 * ## Two sorts, because they carry different risk
 *
 * A **write** changes what you have: a task added, a class marked absent, a
 * timer started. Those are proposed, and every one of them can be put back —
 * see `Undo` below, which is a field on the proposal rather than a hope.
 *
 * A **view** changes what you are looking at: a screen, a filter, a search.
 * Nothing is kept and nothing is lost, so a confirmation card for "open the
 * calendar" would be friction with no safety in it. They are still one tap
 * rather than instant, for a different reason: moving somebody off a
 * half-read answer is its own kind of loss. The exception is a view change on
 * the screen you are already looking at — a filter applied in front of you
 * needs no confirmation because you can see it happen and see it go.
 *
 * ## What has no tool, deliberately
 *
 * Nothing here deletes. Nothing here touches a grade, a dropped score or the
 * grading scale — those numbers are what the projection screens rest on, and
 * a model that can move them is a model that can quietly make every one of
 * those screens wrong. Nothing here changes a syllabus date either: those come
 * from the course module and are the record of what the department said.
 *
 * When somebody asks for one of those, the answer is to say plainly that it
 * cannot and name the screen where they can. Never to simulate it.
 *
 * ## Narrow arguments
 *
 * Every tool takes an id, an enum or a string the student can read back, never
 * a free-form patch. A tool whose argument is "the change to make" is a tool
 * whose confirmation line cannot be written honestly, because nobody can say
 * in advance what it will do.
 */

import { ACCENTS, GROUNDS, SIZES, DENSITIES, type Look } from './look';
import { STAGES, type Application, type Stage } from './apply';
import type { ToolCall, ToolSpec } from './claude';
import type { Action, Persisted } from '../state/shape';
import type { Attended } from './attend';
import type { CourseId, PersonalTask, Screen } from './types';

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
  'drill',
  'exam',
  'registrar',
  'costs',
  'housing',
  'meals',
  'groupwork',
  'gap',
  'clocks',
  'applying',
  'sources',
  'data',
  'help',
];

/** The stages an application can be in, as the app itself names them. */
const STAGE_IDS = STAGES.map((s) => s.id);

/** The look settings a tool may change: named, enumerable, and reversible. */
const LOOK_FIELDS = ['accent', 'ground', 'textSize', 'density'] as const;
type LookField = (typeof LOOK_FIELDS)[number];

const LOOK_VALUES: Record<LookField, string[]> = {
  accent: ACCENTS.map((a) => a.id),
  ground: GROUNDS.map((g) => g.id),
  textSize: SIZES.map((s) => s.id),
  density: DENSITIES.map((d) => d.id),
};

const LOOK_LABEL: Record<LookField, string> = {
  accent: 'accent colour',
  ground: 'background',
  textSize: 'text size',
  density: 'spacing',
};

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
    name: 'move_task',
    description:
      'Move one of the student’s own tasks to a different day, when they say it is not happening today. Only their own tasks — a syllabus deadline is not yours to move, and there is no tool for it.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The task id, exactly as given in the context.' },
        date: { type: 'string', description: 'The new ISO date (2026-09-14).' },
      },
      required: ['id', 'date'],
    },
  },
  {
    name: 'mark_attendance',
    description:
      'Record whether the student was at one class meeting, when they have said so. Never infer it from anything else — an absence they did not report is an absence that did not happen.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        courseId: { type: 'string', description: 'The course id, from the context.' },
        date: { type: 'string', description: 'The meeting’s ISO date (2026-09-14).' },
        mark: { type: 'string', enum: ['present', 'absent', 'excused'], description: 'What to record.' },
      },
      required: ['courseId', 'date', 'mark'],
    },
  },
  {
    name: 'start_timer',
    description:
      'Set a countdown, when the student says how long they want to work. Minutes only.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        minutes: { type: 'number', description: 'How long, in minutes. 1 to 240.' },
        label: { type: 'string', description: 'What it is for, or empty.' },
      },
      required: ['minutes', 'label'],
    },
  },
  {
    name: 'add_note',
    description:
      'Keep something as a note in the student’s own notes, when they ask you to save or write down what you just said. The body is text you have already shown them — never something new they have not read.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'A short title.' },
        body: { type: 'string', description: 'The note itself.' },
        courseId: { type: 'string', description: 'A course id to file it under, or empty.' },
      },
      required: ['title', 'body', 'courseId'],
    },
  },
  {
    name: 'add_source',
    description:
      'Add a reference to the student’s source list, exactly as they gave it to you. Never a source you recalled or reconstructed — this list exists so a bibliography can be trusted, and one invented entry costs it that.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        raw: { type: 'string', description: 'The reference, verbatim as the student wrote it.' },
        courseId: { type: 'string', description: 'A course id, or empty.' },
      },
      required: ['raw', 'courseId'],
    },
  },
  {
    name: 'add_application',
    description:
      'Track an internship, job or programme the student mentions applying to.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        org: { type: 'string', description: 'Who it is with.' },
        role: { type: 'string', description: 'What the post is.' },
        due: { type: 'string', description: 'ISO deadline, or empty if rolling or unstated.' },
      },
      required: ['org', 'role', 'due'],
    },
  },
  {
    name: 'set_look',
    description:
      'Change one thing about how the app looks, when the student asks for it — bigger text, a different background, tighter spacing.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        field: { type: 'string', enum: [...LOOK_FIELDS], description: 'Which setting.' },
        value: {
          type: 'string',
          description:
            'The value. accent: ' +
            `${LOOK_VALUES.accent.join(', ')}. ground: ${LOOK_VALUES.ground.join(', ')}. ` +
            `textSize: ${LOOK_VALUES.textSize.join(', ')}. density: ${LOOK_VALUES.density.join(', ')}.`,
        },
      },
      required: ['field', 'value'],
    },
  },
  {
    name: 'set_day_budget',
    description:
      'Change how many hours a day the student has told the app they have for study. Only when they say it — this number is what every plan on every screen is built from.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { hours: { type: 'number', description: 'Hours a day, 1 to 16.' } },
      required: ['hours'],
    },
  },
  {
    name: 'move_application',
    description:
      'Move an application you are tracking to a different stage, when the student says it has moved.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        org: { type: 'string', description: 'Which organisation, exactly as in the context.' },
        stage: {
          type: 'string',
          enum: [...STAGE_IDS],
          description: 'The stage it has moved to.',
        },
      },
      required: ['org', 'stage'],
    },
  },
  {
    name: 'set_next_step',
    description:
      'Record the one thing to do next on an application, and when it is wanted by. Their own words, not yours.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        org: { type: 'string', description: 'Which organisation, exactly as in the context.' },
        next: { type: 'string', description: 'The one thing to do next.' },
        by: { type: 'string', description: 'ISO date it is wanted by, or empty.' },
      },
      required: ['org', 'next', 'by'],
    },
  },
  {
    name: 'open_screen',
    description:
      'Take the student to a screen in the app, when the answer to their question lives there. Prefer this over describing where to tap. Optionally narrow what they will find there with a filter or a search.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        screen: { type: 'string', enum: REACHABLE, description: 'Which screen.' },
        why: { type: 'string', description: 'One short clause: what they will find there.' },
        search: {
          type: 'string',
          description: 'Text to search for once there, or empty. Only words the student used.',
        },
      },
      required: ['screen', 'why', 'search'],
    },
  },
];

/**
 * How to put a write back.
 *
 * Every proposal that changes something carries one of these, decided before
 * the change happens rather than worked out afterwards. That ordering is the
 * point: "every write is undoable" is only true if the inverse is known at the
 * moment the button is drawn, and a promise of undo that is computed later is
 * a promise that can fail late.
 *
 * The app's own `lib/undo.ts` does not cover this. It snapshots the fields a
 * *removal* damages, and `tookSomething` requires a collection to have shrunk
 * — so an addition would never register there at all. These writes are almost
 * all additions, which is why undoing them is its own small thing.
 */
export type Undo =
  /** The exact inverse, knowable now because the old value is readable now. */
  | { how: 'inverse'; action: Action }
  /**
   * A row about to appear in a list. Undo removes whatever appeared.
   *
   * Ids are minted inside the reducer, so the row's id cannot be known in
   * advance. Comparing the list before against the list after is exact —
   * better than matching on a title, which would remove the wrong row when
   * two things share one.
   */
  | { how: 'appeared'; field: Appears; remove: (id: string) => Action };

/** The lists a tool can add a row to. */
type Appears = 'tasks' | 'notes' | 'sources' | 'applications' | 'timers';

/** A proposal, checked and ready to show. */
export interface Proposal {
  id: string;
  /** What the button will do, in the student's language. */
  said: string;
  /** The word on the button. */
  verb: string;
  action: Action;
  /**
   * Whether this changes what you have or only what you are looking at.
   *
   * A view proposal on the screen you are already on is applied on arrival —
   * see `Ask.tsx`. Everything else waits for a tap either way.
   */
  sort: 'write' | 'view';
  /** How to put it back. Absent only on a view, which changes nothing to put. */
  undo?: Undo;
  /** For a view: the screen it targets, so "already there" can be decided. */
  screen?: Screen;
  /**
   * For a view: text to search for once there.
   *
   * Carried beside the action rather than inside it because `go` and
   * `setQuery` are two dispatches, and the screen runs them in that order so
   * it arrives already narrowed rather than narrowing in front of you.
   */
  search?: string;
  /** Said after it runs: what changed, past tense. */
  did: string;
}

/** What the app actually holds, for checking a tool call against reality. */
export interface Known {
  deadlines: { id: string; title: string }[];
  tasks: Pick<PersonalTask, 'id' | 'title' | 'date'>[];
  courses: { id: CourseId; code: string }[];
  attendance: Attended[];
  look: Look;
  /** What is being tracked, so a tool call can be matched to a real one. */
  applications: Pick<Application, 'id' | 'org' | 'role' | 'stage' | 'next' | 'nextBy'>[];
  /** Hours a day the student has said they have. */
  dayBudget: number;
}

function str(input: Record<string, unknown>, key: string): string {
  const v = input[key];
  return typeof v === 'string' ? v.trim() : '';
}

function num(input: Record<string, unknown>, key: string): number | null {
  const v = input[key];
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
}

/** A date the app can actually store, or nothing. */
function iso(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

/** A readable day, so a confirmation line is a sentence rather than a field. */
function day(value: string): string {
  const d = new Date(`${value}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * Turn a tool call into something showable, or nothing.
 *
 * Every call is re-checked here against what the app actually holds, because
 * a tool argument is the model's belief and not a fact: an id it invented, a
 * screen that does not exist, an empty title, a look setting that is not one
 * of the four. A proposal that cannot be described exactly is not shown at
 * all — silence is better than a button whose label is a guess.
 */
export function readProposal(call: ToolCall, known: Known): Proposal | null {
  const { id } = call;

  if (call.name === 'tick_deadline') {
    const which = str(call.input, 'id');
    // The id has to be one the app holds. Otherwise the button would tick
    // nothing and report success.
    const real = known.deadlines.find((d) => d.id === which);
    if (!real) return null;
    return {
      id,
      said: `Tick off “${real.title}” as done`,
      did: `“${real.title}” is ticked off`,
      verb: 'Tick it',
      sort: 'write',
      action: { type: 'toggleDone', id: which },
      // Ticking is its own inverse, which is the whole reason it is safe.
      undo: { how: 'inverse', action: { type: 'toggleDone', id: which } },
    };
  }

  if (call.name === 'add_task') {
    const title = str(call.input, 'title');
    if (!title) return null;
    const when = iso(str(call.input, 'date'));
    return {
      id,
      said: when ? `Add “${title}” to your list for ${day(when)}` : `Add “${title}” to your list`,
      did: `“${title}” is on your list`,
      verb: 'Add it',
      sort: 'write',
      action: {
        type: 'addTask',
        task: { title, date: when || null, time: '', note: '', courseId: null },
      },
      undo: { how: 'appeared', field: 'tasks', remove: (row) => ({ type: 'deleteTask', id: row }) },
    };
  }

  if (call.name === 'move_task') {
    const which = str(call.input, 'id');
    const task = known.tasks.find((t) => t.id === which);
    const when = iso(str(call.input, 'date'));
    if (!task || !when) return null;
    return {
      id,
      said: `Move “${task.title}” to ${day(when)}`,
      did: `“${task.title}” is now on ${day(when)}`,
      verb: 'Move it',
      sort: 'write',
      action: { type: 'editTask', id: which, patch: { date: when } },
      // The old date, read now. This is why the undo is built before the write.
      undo: {
        how: 'inverse',
        action: { type: 'editTask', id: which, patch: { date: task.date } },
      },
    };
  }

  if (call.name === 'mark_attendance') {
    const courseId = str(call.input, 'courseId') as CourseId;
    const course = known.courses.find((c) => c.id === courseId);
    const date = iso(str(call.input, 'date'));
    const mark = str(call.input, 'mark') as Attended['mark'];
    if (!course || !date || !['present', 'absent', 'excused'].includes(mark)) return null;
    // `courseId:date` is derived, not random — see `Attended`. So the current
    // mark is a lookup rather than a scan, and the undo is exact.
    const was = known.attendance.find((a) => a.id === `${courseId}:${date}`)?.mark ?? null;
    if (was === mark) return null;
    return {
      id,
      said: `Mark you ${mark} for ${course.code} on ${day(date)}`,
      did: `${course.code} on ${day(date)} is marked ${mark}`,
      verb: 'Record it',
      sort: 'write',
      action: { type: 'markAttendance', courseId, date, mark },
      undo: { how: 'inverse', action: { type: 'markAttendance', courseId, date, mark: was } },
    };
  }

  if (call.name === 'start_timer') {
    const minutes = num(call.input, 'minutes');
    if (minutes === null || minutes < 1 || minutes > 240) return null;
    const label = str(call.input, 'label');
    const whole = Math.round(minutes);
    return {
      id,
      said: label ? `Start a ${whole}-minute timer for ${label}` : `Start a ${whole}-minute timer`,
      did: `A ${whole}-minute timer is running`,
      verb: 'Start it',
      sort: 'write',
      action: { type: 'addTimer', label, seconds: whole * 60, at: Date.now() },
      undo: {
        how: 'appeared',
        field: 'timers',
        remove: (row) => ({ type: 'removeTimer', id: row }),
      },
    };
  }

  if (call.name === 'add_note') {
    const title = str(call.input, 'title');
    const body = str(call.input, 'body');
    if (!title || !body) return null;
    const courseId = str(call.input, 'courseId') as CourseId;
    const course = known.courses.find((c) => c.id === courseId);
    return {
      id,
      said: `Keep “${title}” as a note${course ? ` on ${course.code}` : ''} — ${body.length} characters`,
      did: `“${title}” is in your notes`,
      verb: 'Keep it',
      sort: 'write',
      action: { type: 'keepNote', title, body, courseId: course ? courseId : null },
      undo: { how: 'appeared', field: 'notes', remove: (row) => ({ type: 'deleteNote', id: row }) },
    };
  }

  if (call.name === 'add_source') {
    const raw = str(call.input, 'raw');
    if (!raw) return null;
    const courseId = str(call.input, 'courseId') as CourseId;
    const course = known.courses.find((c) => c.id === courseId);
    return {
      id,
      said: `Add “${raw}” to your sources${course ? ` for ${course.code}` : ''}`,
      did: 'The source is in your list',
      verb: 'Add it',
      sort: 'write',
      // `raw` is kept verbatim and never overwritten by the parser — see
      // `lib/sources.ts`. The fields it can read out of a line are read there.
      action: {
        type: 'addSource',
        source: {
          raw,
          author: '',
          year: '',
          title: '',
          container: '',
          url: '',
          role: '',
          courseId: course ? courseId : null,
          project: '',
        },
      },
      undo: {
        how: 'appeared',
        field: 'sources',
        remove: (row) => ({ type: 'dropSource', id: row }),
      },
    };
  }

  if (call.name === 'add_application') {
    const org = str(call.input, 'org');
    const role = str(call.input, 'role');
    if (!org || !role) return null;
    const due = iso(str(call.input, 'due'));
    return {
      id,
      said: `Track ${role} at ${org}${due ? `, due ${day(due)}` : ''}`,
      did: `${role} at ${org} is being tracked`,
      verb: 'Track it',
      sort: 'write',
      action: { type: 'addApplication', patch: { org, role, due, rolling: !due } },
      undo: {
        how: 'appeared',
        field: 'applications',
        remove: (row) => ({ type: 'removeApplication', id: row }),
      },
    };
  }

  if (call.name === 'set_look') {
    const field = str(call.input, 'field') as LookField;
    if (!LOOK_FIELDS.includes(field)) return null;
    const value = str(call.input, 'value');
    if (!LOOK_VALUES[field].includes(value)) return null;
    const was = known.look[field];
    if (was === value) return null;
    return {
      id,
      said: `Set the ${LOOK_LABEL[field]} to ${value}`,
      did: `The ${LOOK_LABEL[field]} is ${value}`,
      verb: 'Change it',
      sort: 'write',
      action: { type: 'setLook', look: { [field]: value } },
      undo: { how: 'inverse', action: { type: 'setLook', look: { [field]: was } } },
    };
  }

  if (call.name === 'set_day_budget') {
    const hours = num(call.input, 'hours');
    if (hours === null || hours < 1 || hours > 16) return null;
    const whole = Math.round(hours * 2) / 2;
    if (whole === known.dayBudget) return null;
    return {
      id,
      said: `Set your study budget to ${whole} hours a day, from ${known.dayBudget}`,
      did: `Your study budget is ${whole} hours a day`,
      verb: 'Set it',
      sort: 'write',
      action: { type: 'setDayBudget', hours: whole },
      // Every plan on every screen is built from this number, so the old one
      // is carried rather than assumed to be the default.
      undo: { how: 'inverse', action: { type: 'setDayBudget', hours: known.dayBudget } },
    };
  }

  if (call.name === 'move_application') {
    const org = str(call.input, 'org');
    const stage = str(call.input, 'stage') as Stage;
    const app = known.applications.find((a) => a.org.toLowerCase() === org.toLowerCase());
    if (!app || !STAGE_IDS.includes(stage) || app.stage === stage) return null;
    const named = STAGES.find((s) => s.id === stage)?.label ?? stage;
    const was = STAGES.find((s) => s.id === app.stage)?.label ?? app.stage;
    return {
      id,
      said: `Move ${app.role} at ${app.org} from ${was} to ${named}`,
      did: `${app.role} at ${app.org} is at ${named}`,
      verb: 'Move it',
      sort: 'write',
      action: { type: 'moveApplication', id: app.id, stage },
      undo: { how: 'inverse', action: { type: 'moveApplication', id: app.id, stage: app.stage } },
    };
  }

  if (call.name === 'set_next_step') {
    const org = str(call.input, 'org');
    const next = str(call.input, 'next');
    const app = known.applications.find((a) => a.org.toLowerCase() === org.toLowerCase());
    if (!app || !next) return null;
    const by = iso(str(call.input, 'by'));
    return {
      id,
      said: `On ${app.role} at ${app.org}, set the next step to "${next}"${by ? `, by ${day(by)}` : ''}`,
      did: `The next step on ${app.org} is "${next}"`,
      verb: 'Set it',
      sort: 'write',
      action: { type: 'patchApplication', id: app.id, patch: { next, nextBy: by } },
      undo: {
        how: 'inverse',
        action: {
          type: 'patchApplication',
          id: app.id,
          patch: { next: app.next, nextBy: app.nextBy },
        },
      },
    };
  }

  if (call.name === 'open_screen') {
    const screen = str(call.input, 'screen') as Screen;
    if (!REACHABLE.includes(screen)) return null;
    const why = str(call.input, 'why');
    const search = str(call.input, 'search').slice(0, 60);
    const where = label(screen);
    return {
      id,
      said:
        `Open ${where}` +
        (search ? `, searching for “${search}”` : '') +
        (why ? ` — ${why}` : ''),
      did: search ? `${where}, searching for “${search}”` : where,
      verb: 'Open it',
      sort: 'view',
      screen,
      search,
      action: { type: 'go', screen },
      // Deliberately no undo: nothing was kept, so there is nothing to put
      // back. Going somewhere is undone by going back.
    };
  }

  return null;
}

/** The lists a write can add a row to, as an undo needs to see them. */
export type Lists = Pick<Persisted, Appears>;

/**
 * What to dispatch to put a write back, given the state either side of it.
 *
 * Returns nothing when the write did not take — an id that had already gone, a
 * store that was full. An Undo button that dispatches nothing and says it
 * worked is worse than no Undo button.
 */
export function undoFor(undo: Undo, before: Lists, after: Lists): Action | null {
  if (undo.how === 'inverse') return undo.action;
  const had = new Set(before[undo.field].map((row) => row.id));
  const fresh = after[undo.field].find((row) => !had.has(row.id));
  return fresh ? undo.remove(fresh.id) : null;
}

/** What a screen is called, for a sentence rather than a route. */
function label(screen: Screen): string {
  const named: Partial<Record<Screen, string>> = {
    home: 'Today',
    courses: 'Courses',
    study: 'Study',
    calendar: 'the calendar',
    mine: 'Personal',
    me: 'Progress',
    runway: 'the exam runway',
    ahead: 'the week ahead',
    drill: 'the drill',
    exam: 'a practice paper',
    registrar: 'term deadlines',
    costs: 'what this term cost',
    housing: 'Housing',
    meals: 'the meal plan',
    groupwork: 'group work',
    gap: 'the between-classes mode',
    clocks: 'timers and alarms',
    applying: 'applications',
    sources: 'your sources',
    data: 'your data',
    help: 'the guide to this app',
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
