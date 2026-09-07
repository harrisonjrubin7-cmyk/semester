import { describe, expect, it } from 'vitest';
import { proposalsLine, readProposal, TOOLS, undoFor, type Known, type Proposal } from './tools';
import type { ToolCall } from './claude';
import type { Attended } from './attend';
import type { CourseId } from './types';

/**
 * What the assistant may do, and what it may never do.
 *
 * Three rules are load-bearing and each has a test that fails loudly if it
 * stops holding: nothing runs from model output, nothing deletes, and every
 * write can be put back. The last one is the reason `undoFor` exists at all —
 * the app's own undo covers removals, and these writes are almost all
 * additions.
 */

const known: Known = {
  deadlines: [
    { id: 'econ-ps4', title: 'Problem Set 4' },
    { id: 'core-r2', title: 'Reflection #2' },
  ],
  tasks: [{ id: 't1', title: 'Email Dr Stromme', date: '2026-09-14' }],
  courses: [
    { id: 'econ' as CourseId, code: 'ECON 1020' },
    { id: 'bus' as CourseId, code: 'BUS 1600' },
  ],
  attendance: [
    { id: 'econ:2026-09-10', courseId: 'econ' as CourseId, date: '2026-09-10', mark: 'present', at: 0 },
  ] as Attended[],
  look: { accent: 'brass', textSize: 'normal', ground: 'ink', density: 'comfortable' },
  applications: [
    { id: 'a1', org: 'Deloitte', role: 'Summer analyst', stage: 'sent', next: 'Follow up', nextBy: '' },
  ],
  dayBudget: 4,
};

const call = (name: string, input: Record<string, unknown>): ToolCall => ({
  id: 'toolu_1',
  name,
  input,
});

const read = (name: string, input: Record<string, unknown>) => readProposal(call(name, input), known);

describe('what it is allowed to offer', () => {
  it('offers nothing that deletes, and nothing that touches a grade', () => {
    /*
     * The list is asserted whole rather than by property, because the failure
     * this guards against is a tool being *added* — and a property test passes
     * happily for a `delete_course` that is honestly named.
     */
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      'add_application',
      'add_note',
      'add_source',
      'add_task',
      'mark_attendance',
      'move_application',
      'move_task',
      'open_screen',
      'set_day_budget',
      'set_look',
      'set_next_step',
      'start_timer',
      'tick_deadline',
    ]);
    const words = TOOLS.map((t) => `${t.name} ${t.description}`).join(' ').toLowerCase();
    expect(words).not.toContain('delete');
    expect(words).not.toContain('remove');
  });

  it('has no tool that changes a grade, a drop or the scale', () => {
    // Those numbers are what every projection screen rests on. A model that
    // can move them is a model that can quietly make all of them wrong.
    const actions = [
      read('tick_deadline', { id: 'econ-ps4', title: 'x' }),
      read('add_task', { title: 'x', date: '' }),
      read('move_task', { id: 't1', date: '2026-09-20' }),
      read('mark_attendance', { courseId: 'econ', date: '2026-09-11', mark: 'absent' }),
      read('start_timer', { minutes: 25, label: '' }),
      read('add_note', { title: 'x', body: 'y', courseId: '' }),
      read('add_source', { raw: 'Smith 2020', courseId: '' }),
      read('add_application', { org: 'x', role: 'y', due: '' }),
      read('set_day_budget', { hours: 6 }),
      read('move_application', { org: 'Deloitte', stage: 'talking' }),
      read('set_next_step', { org: 'Deloitte', next: 'Send the transcript', by: '' }),
      read('set_look', { field: 'textSize', value: 'large' }),
      read('open_screen', { screen: 'home', why: '', search: '' }),
    ].map((p) => p!.action.type);
    for (const banned of ['setGrade', 'setDrop', 'setScale', 'setCutoffs', 'setPieces']) {
      expect(actions).not.toContain(banned);
    }
  });

  it('asks the API to guarantee the arguments validate', () => {
    expect(TOOLS.every((t) => t.strict === true)).toBe(true);
  });

  it('gives every write an undo and every view none', () => {
    // "Every write is undoable" is only true if the inverse is decided before
    // the button is drawn. This is that, checked.
    for (const p of [
      read('tick_deadline', { id: 'econ-ps4', title: 'x' }),
      read('add_task', { title: 'x', date: '' }),
      read('move_task', { id: 't1', date: '2026-09-20' }),
      read('mark_attendance', { courseId: 'econ', date: '2026-09-11', mark: 'absent' }),
      read('start_timer', { minutes: 25, label: '' }),
      read('add_note', { title: 'x', body: 'y', courseId: '' }),
      read('add_source', { raw: 'Smith 2020', courseId: '' }),
      read('add_application', { org: 'x', role: 'y', due: '' }),
      read('set_day_budget', { hours: 6 }),
      read('move_application', { org: 'Deloitte', stage: 'talking' }),
      read('set_next_step', { org: 'Deloitte', next: 'Send the transcript', by: '' }),
      read('set_look', { field: 'textSize', value: 'large' }),
    ] as Proposal[]) {
      expect(p.sort, p.said).toBe('write');
      expect(p.undo, p.said).toBeDefined();
    }
    const view = read('open_screen', { screen: 'home', why: '', search: '' })!;
    expect(view.sort).toBe('view');
    expect(view.undo).toBeUndefined();
  });

  it('says what it did as well as what it would do', () => {
    // The line after the tap. Without it a run proposal reads as if it is
    // still waiting, which is the one ambiguity this whole design avoids.
    const p = read('add_task', { title: 'Read chapter 3', date: '' })!;
    expect(p.said).toContain('Add');
    expect(p.did).toBe('“Read chapter 3” is on your list');
  });
});

describe('ticking a deadline', () => {
  it('describes exactly what the button will do', () => {
    const p = read('tick_deadline', { id: 'econ-ps4', title: 'PS4' });
    expect(p?.said).toBe('Tick off “Problem Set 4” as done');
    expect(p?.action).toEqual({ type: 'toggleDone', id: 'econ-ps4' });
  });

  it('uses the app’s title, not the model’s', () => {
    // The model passed "PS4"; the app holds "Problem Set 4". The student is
    // confirming against what the app will actually change.
    const p = read('tick_deadline', { id: 'econ-ps4', title: 'PS4' });
    expect(p?.said).toContain('Problem Set 4');
    expect(p?.said).not.toContain('PS4');
  });

  it('refuses an id the app does not hold', () => {
    // Otherwise the button ticks nothing and reports success.
    expect(read('tick_deadline', { id: 'invented', title: 'x' })).toBeNull();
    expect(read('tick_deadline', {})).toBeNull();
  });

  it('is its own undo, which is why it is safe', () => {
    const p = read('tick_deadline', { id: 'econ-ps4', title: 'x' })!;
    expect(p.undo).toEqual({ how: 'inverse', action: { type: 'toggleDone', id: 'econ-ps4' } });
  });
});

describe('adding a task', () => {
  it('says the date as a person would say it', () => {
    const p = read('add_task', { title: 'Email Dr Stromme', date: '2026-09-14' });
    expect(p?.said).toContain('Email Dr Stromme');
    expect(p?.said).toContain('September 14');
    expect(p?.action).toEqual({
      type: 'addTask',
      task: { title: 'Email Dr Stromme', date: '2026-09-14', time: '', note: '', courseId: null },
    });
  });

  it('drops a date it cannot read', () => {
    // Undated is a real state. A date the app cannot parse would land the
    // task on a day nobody chose.
    const p = read('add_task', { title: 'Email him', date: 'next Friday' });
    expect(p?.said).toBe('Add “Email him” to your list');
    expect((p!.action as { task: { date: null } }).task.date).toBeNull();
  });

  it('refuses a task with nothing in it', () => {
    expect(read('add_task', { title: '   ', date: '' })).toBeNull();
  });
});

describe('moving a task', () => {
  it('moves only tasks the student owns', () => {
    // A syllabus deadline is the record of what the department said. There is
    // no tool for moving one, and an id from that list finds nothing here.
    expect(read('move_task', { id: 'econ-ps4', date: '2026-09-20' })).toBeNull();
    expect(read('move_task', { id: 't1', date: '2026-09-20' })?.said).toContain('Email Dr Stromme');
  });

  it('carries the old date, read before the change', () => {
    const p = read('move_task', { id: 't1', date: '2026-09-20' })!;
    expect(p.undo).toEqual({
      how: 'inverse',
      action: { type: 'editTask', id: 't1', patch: { date: '2026-09-14' } },
    });
  });

  it('refuses a date it cannot read, rather than nulling the one there', () => {
    expect(read('move_task', { id: 't1', date: 'sometime' })).toBeNull();
  });
});

describe('marking attendance', () => {
  it('names the course and the day in the line', () => {
    const p = read('mark_attendance', { courseId: 'econ', date: '2026-09-11', mark: 'absent' });
    expect(p?.said).toBe('Mark you absent for ECON 1020 on Friday, September 11');
  });

  it('puts back what was there before, including nothing', () => {
    // `courseId:date` is derived, so the current mark is a lookup. A meeting
    // never marked undoes to unmarked, not to present.
    const fresh = read('mark_attendance', { courseId: 'econ', date: '2026-09-11', mark: 'absent' })!;
    expect(fresh.undo).toEqual({
      how: 'inverse',
      action: { type: 'markAttendance', courseId: 'econ', date: '2026-09-11', mark: null },
    });
    const over = read('mark_attendance', { courseId: 'econ', date: '2026-09-10', mark: 'absent' })!;
    expect(over.undo).toEqual({
      how: 'inverse',
      action: { type: 'markAttendance', courseId: 'econ', date: '2026-09-10', mark: 'present' },
    });
  });

  it('offers nothing when it would change nothing', () => {
    expect(read('mark_attendance', { courseId: 'econ', date: '2026-09-10', mark: 'present' })).toBeNull();
  });

  it('refuses a course it does not hold and a mark that is not one', () => {
    expect(read('mark_attendance', { courseId: 'psci', date: '2026-09-11', mark: 'absent' })).toBeNull();
    expect(read('mark_attendance', { courseId: 'econ', date: '2026-09-11', mark: 'late' })).toBeNull();
  });
});

describe('starting a timer', () => {
  it('takes minutes and stores seconds', () => {
    const p = read('start_timer', { minutes: 25, label: 'ECON reading' });
    expect(p?.said).toBe('Start a 25-minute timer for ECON reading');
    expect((p!.action as { seconds: number }).seconds).toBe(1500);
  });

  it('refuses a length nobody would ask for', () => {
    // Zero is not a timer and four hours is not a countdown.
    expect(read('start_timer', { minutes: 0, label: '' })).toBeNull();
    expect(read('start_timer', { minutes: 600, label: '' })).toBeNull();
    expect(read('start_timer', { minutes: 'a while', label: '' })).toBeNull();
  });
});

describe('keeping a note', () => {
  it('says how long it is, because the body is not shown on the card', () => {
    const p = read('add_note', { title: 'Elasticity', body: 'x'.repeat(400), courseId: 'econ' });
    expect(p?.said).toBe('Keep “Elasticity” as a note on ECON 1020 — 400 characters');
  });

  it('files it under no course when the id is not one', () => {
    const p = read('add_note', { title: 'x', body: 'y', courseId: 'invented' });
    expect((p!.action as { courseId: null }).courseId).toBeNull();
  });

  it('refuses an empty note', () => {
    expect(read('add_note', { title: 'x', body: '  ', courseId: '' })).toBeNull();
  });
});

describe('adding a source', () => {
  it('keeps the line verbatim and parses nothing', () => {
    /*
     * `raw` is never overwritten by the parser — see `lib/sources.ts`. A wrong
     * author in a bibliography is worse than no author, because the raw line
     * is right there to read and a parsed field looks like it was checked.
     */
    const p = read('add_source', { raw: 'Porter, M. (1980). Competitive Strategy.', courseId: 'bus' });
    const source = (p!.action as { source: Record<string, string> }).source;
    expect(source.raw).toBe('Porter, M. (1980). Competitive Strategy.');
    expect(source.author).toBe('');
    expect(source.title).toBe('');
  });
});

describe('tracking an application', () => {
  it('reads no date as rolling, which is a real state', () => {
    const p = read('add_application', { org: 'Deloitte', role: 'Summer analyst', due: '' });
    expect(p?.said).toBe('Track Summer analyst at Deloitte');
    expect((p!.action as { patch: { rolling: boolean } }).patch.rolling).toBe(true);
  });

  it('refuses one with no organisation or no role', () => {
    expect(read('add_application', { org: '', role: 'Analyst', due: '' })).toBeNull();
  });
});

describe('changing the look', () => {
  it('takes only the four named settings and their own values', () => {
    expect(read('set_look', { field: 'textSize', value: 'large' })?.said).toBe(
      'Set the text size to large',
    );
    expect(read('set_look', { field: 'textSize', value: 'huge' })).toBeNull();
    // Not every field on `Look` is offered. `shell` redraws every screen and
    // `hue` is a slider, and neither is a thing to change on somebody's behalf.
    expect(read('set_look', { field: 'shell', value: 'grouped' })).toBeNull();
  });

  it('carries the value it is replacing', () => {
    const p = read('set_look', { field: 'accent', value: 'jade' })!;
    expect(p.undo).toEqual({ how: 'inverse', action: { type: 'setLook', look: { accent: 'brass' } } });
  });

  it('offers nothing when it is already that', () => {
    expect(read('set_look', { field: 'accent', value: 'brass' })).toBeNull();
  });
});

describe('opening a screen', () => {
  it('names the screen the way a person would', () => {
    const p = read('open_screen', { screen: 'runway', why: 'it counts back from the exam', search: '' });
    expect(p?.said).toBe('Open the exam runway — it counts back from the exam');
    expect(p?.action).toEqual({ type: 'go', screen: 'runway' });
  });

  it('says the search in the line, so arriving somewhere filtered is not a surprise', () => {
    const p = read('open_screen', { screen: 'mine', why: 'your own list', search: 'Stromme' });
    expect(p?.said).toBe('Open Personal, searching for “Stromme” — your own list');
  });

  it('refuses a screen that is not on the list', () => {
    expect(read('open_screen', { screen: 'account', why: 'x', search: '' })).toBeNull();
    expect(read('open_screen', { screen: 'nonsense', why: 'x', search: '' })).toBeNull();
  });
});

describe('putting a write back', () => {
  const empty = { tasks: [], notes: [], sources: [], applications: [], timers: [] };

  it('removes the row that appeared, not the one with the same name', () => {
    /*
     * Ids are minted inside the reducer, so the new row's id cannot be known
     * in advance. Comparing before against after is exact; matching on a title
     * would delete the older of two tasks called the same thing.
     */
    const p = read('add_task', { title: 'Read chapter 3', date: '' })!;
    const before = { ...empty, tasks: [{ id: 'old', title: 'Read chapter 3' }] };
    const after = {
      ...empty,
      tasks: [{ id: 'old', title: 'Read chapter 3' }, { id: 'new', title: 'Read chapter 3' }],
    };
    expect(undoFor(p.undo!, before as never, after as never)).toEqual({
      type: 'deleteTask',
      id: 'new',
    });
  });

  it('offers nothing when the write did not take', () => {
    // A full store, an id already gone. An Undo that dispatches nothing and
    // says it worked is worse than no Undo at all.
    const p = read('add_note', { title: 'x', body: 'y', courseId: '' })!;
    expect(undoFor(p.undo!, empty as never, empty as never)).toBeNull();
  });

  it('returns a known inverse unchanged, without looking at either state', () => {
    const p = read('set_look', { field: 'accent', value: 'jade' })!;
    expect(undoFor(p.undo!, empty as never, empty as never)).toEqual({
      type: 'setLook',
      look: { accent: 'brass' },
    });
  });
});

describe('the study budget', () => {
  it('carries the number it is replacing, because every plan rests on it', () => {
    const p = read('set_day_budget', { hours: 6 })!;
    expect(p.said).toBe('Set your study budget to 6 hours a day, from 4');
    expect(p.undo).toEqual({ how: 'inverse', action: { type: 'setDayBudget', hours: 4 } });
  });

  it('refuses a number nobody would mean', () => {
    // Zero hours is not a budget and twenty is not a day.
    expect(read('set_day_budget', { hours: 0 })).toBeNull();
    expect(read('set_day_budget', { hours: 20 })).toBeNull();
    // Already that: nothing to offer.
    expect(read('set_day_budget', { hours: 4 })).toBeNull();
  });
});

describe('applications', () => {
  it('moves one that exists, by the organisation the student named', () => {
    const p = read('move_application', { org: 'deloitte', stage: 'talking' })!;
    expect(p.said).toBe('Move Summer analyst at Deloitte from Sent to Talking');
    expect(p.action).toEqual({ type: 'moveApplication', id: 'a1', stage: 'talking' });
  });

  it('refuses one it does not hold, and a stage that is not one', () => {
    expect(read('move_application', { org: 'Invented Ltd', stage: 'offer' })).toBeNull();
    expect(read('move_application', { org: 'Deloitte', stage: 'ghosted' })).toBeNull();
    // Already there.
    expect(read('move_application', { org: 'Deloitte', stage: 'sent' })).toBeNull();
  });

  it('records a next step and can put the old one back', () => {
    const p = read('set_next_step', { org: 'Deloitte', next: 'Send the transcript', by: '2026-10-01' })!;
    expect(p.said).toContain('Send the transcript');
    expect(p.said).toContain('October 1');
    expect(p.undo).toEqual({
      how: 'inverse',
      action: { type: 'patchApplication', id: 'a1', patch: { next: 'Follow up', nextBy: '' } },
    });
  });
});

describe('a tool nobody defined', () => {
  it('produces nothing rather than a guess', () => {
    expect(read('delete_everything', { sure: true })).toBeNull();
  });
});

describe('what sits above the buttons', () => {
  it('says nothing has happened yet', () => {
    // The whole arrangement depends on the student believing that, and one
    // ambiguous moment is enough to lose it.
    const p = read('tick_deadline', { id: 'econ-ps4', title: 'x' })!;
    expect(proposalsLine([p])).toContain('nothing has happened yet');
    expect(proposalsLine([])).toBe('');
  });
});
