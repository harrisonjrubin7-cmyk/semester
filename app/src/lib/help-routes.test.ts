import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTEXT_KEYS,
  DIRECTORY_ONLY,
  KIND_TEXT,
  NEEDS,
  REQUEST_STATUSES,
  STAFF_MOVES,
  WITHDRAWABLE,
  answerRequest,
  replyAfter,
  askForHelp,
  helpFromAction,
  helpSeedWaiting,
  takeHelpSeed,
  seedHelp,
  asNote,
  emptyDraft,
  followUp,
  needById,
  payload,
  preview,
  sendable,
  type ContextKey,
  type Draft,
} from './help-routes';

/**
 * Every help-request migration, oldest first. A later one may redefine a
 * function, so each probe below reads the **last** definition of what it asks
 * about — the one a deployed database ends up with.
 */
const DIR = resolve(__dirname, '../../../supabase/migrations');
const MIGRATION = readdirSync(DIR)
  .filter((f) => /_help_/.test(f))
  .sort()
  .map((f) => readFileSync(resolve(DIR, f), 'utf8'))
  .join('\n');

/** The quoted words inside the first `(...)` after `marker`. */
function quotedAfter(marker: string): string[] {
  const at = MIGRATION.lastIndexOf(marker);
  expect(at, `${marker} not found in the migration`).toBeGreaterThan(-1);
  const open = MIGRATION.indexOf('(', at + marker.length - 1);
  let depth = 0;
  let end = open;
  for (; end < MIGRATION.length; end++) {
    if (MIGRATION[end] === '(') depth++;
    if (MIGRATION[end] === ')' && --depth === 0) break;
  }
  return [...MIGRATION.slice(open, end).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

const draft = (over: Partial<Draft> = {}): Draft => ({ ...emptyDraft(), ...over });

describe('the app and the database mean the same words', () => {
  it('the context vocabulary is the database’s, in its order', () => {
    expect(quotedAfter('where e.key not in')).toEqual([...CONTEXT_KEYS]);
  });

  it('the destination kinds are the database’s', () => {
    expect(quotedAfter('kind             text        not null check (kind in').sort()).toEqual(
      Object.keys(KIND_TEXT).sort(),
    );
  });

  it('the directory-only kinds are the ones the database refuses requests for', () => {
    expect(quotedAfter('kind not in').sort()).toEqual([...DIRECTORY_ONLY].sort());
  });

  it('the statuses are the database’s', () => {
    expect(quotedAfter("status         text        not null default 'sent' check (status in")).toEqual([
      ...REQUEST_STATUSES,
    ]);
  });

  it('staff moves are the moves answer_help_request allows', () => {
    const body = MIGRATION.slice(MIGRATION.lastIndexOf('create or replace function public.answer_help_request'));
    for (const [from, tos] of Object.entries(STAFF_MOVES)) {
      const clause = body.match(new RegExp(`r\\.status = '${from}'\\s+and want_status (?:in \\(([^)]*)\\)|= '([a-z_]+)')`));
      const allowed = clause ? [...(clause[1] ?? `'${clause[2]}'`).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : [];
      expect(allowed, `from ${from}`).toEqual([...tos]);
    }
  });

  it('a student withdraws from exactly the statuses withdraw_help_request accepts', () => {
    expect(quotedAfter("student_id = me and status in").sort()).toEqual([...WITHDRAWABLE].sort());
  });
});

describe('what leaves is what the student saw', () => {
  it('starts with nothing ticked, so the default is the question alone', () => {
    const d = draft({ question: 'Which stats course?', fields: { course: 'PSY 340', requirement: 'Stats' } });
    expect(d.ticked.size).toBe(0);
    expect(payload(d)).toEqual({ question: 'Which stats course?', context: {} });
  });

  it('sends a typed field only when ticked', () => {
    const d = draft({
      question: 'Which stats course?',
      fields: { course: 'PSY 340', requirement: 'Stats before PSY 340' },
      ticked: new Set<ContextKey>(['requirement']),
    });
    expect(payload(d).context).toEqual({ requirement: 'Stats before PSY 340' });
  });

  it('the payload is the preview, line for line', () => {
    const d = draft({
      question: '  Stuck on PS3  ',
      fields: { course: 'ECON 1020', assignment: 'PS3', tried: '' },
      ticked: new Set<ContextKey>(['course', 'assignment', 'tried']),
    });
    const lines = preview(d);
    const sent = payload(d);
    expect(lines.map((l) => l.key)).toEqual(['question', 'course', 'assignment']);
    expect(lines.find((l) => l.key === 'question')?.value).toBe(sent.question);
    for (const line of lines.filter((l) => l.key !== 'question')) {
      expect(sent.context[line.key as ContextKey]).toBe(line.value);
    }
    expect(Object.keys(sent.context)).toHaveLength(lines.length - 1);
  });

  it('drops a ticked field left empty rather than sending it blank', () => {
    const d = draft({ question: 'Q', ticked: new Set<ContextKey>(['deadline']) });
    expect(payload(d).context).toEqual({});
  });

  it('trims to the limits the database checks', () => {
    const d = draft({ question: 'x'.repeat(5000), fields: { course: 'y'.repeat(900) }, ticked: new Set<ContextKey>(['course']) });
    const sent = payload(d);
    expect(sent.question).toHaveLength(2000);
    expect(sent.context.course).toHaveLength(600);
  });

  it('refuses to send without a question', () => {
    expect(sendable(draft({ question: '   ' }))).toMatch(/question/i);
    expect(sendable(draft({ question: 'Help' }))).toBeNull();
  });

  it('the take-it-yourself note carries only what would have been sent', () => {
    const d = draft({ question: 'Q', fields: { course: 'C', plan: 'secret plan' }, ticked: new Set<ContextKey>(['course']) });
    const note = asNote(d, 'advisor');
    expect(note).toContain('Which course: C');
    expect(note).not.toContain('secret plan');
  });
});

describe('the routes', () => {
  it('wellbeing, accessibility and money are directory-only and offer no fields', () => {
    for (const id of ['wellbeing', 'accessibility', 'money'] as const) {
      const need = needById(id);
      expect(need.directoryOnly).toBe(true);
      expect(need.offer).toEqual([]);
      expect(need.note).toMatch(/does not send or store/);
    }
  });

  it('wellbeing names no destination the app could send to, and names a crisis line', () => {
    expect(needById('wellbeing').kinds).toEqual([]);
    expect(needById('wellbeing').note).toMatch(/988/);
  });

  it('a need that sends never routes to a directory-only office', () => {
    for (const need of NEEDS.filter((n) => !n.directoryOnly)) {
      for (const kind of need.kinds) expect(DIRECTORY_ONLY.has(kind), `${need.id} → ${kind}`).toBe(false);
    }
  });

  it('every offered field is in the vocabulary', () => {
    for (const need of NEEDS) for (const key of need.offer) expect(CONTEXT_KEYS).toContain(key);
  });

  it('a scheduled request hands back a next step, and a withdrawn one does not', () => {
    expect(followUp('scheduled', 'Tuesday 2pm')).toMatch(/Tuesday 2pm/);
    expect(followUp('scheduled', '')).toMatch(/Prepare/);
    expect(followUp('withdrawn', '')).toBeNull();
  });

  it('a closed request can still be withdrawn and erased', () => {
    expect(WITHDRAWABLE.has('closed')).toBe(true);
    expect(WITHDRAWABLE.has('withdrawn')).toBe(false);
  });
});

describe('the staff side', () => {
  it('a blank answer keeps the reply already sent, as the database does', () => {
    expect(replyAfter('Tuesday 2pm', '')).toBe('Tuesday 2pm');
    expect(replyAfter('Tuesday 2pm', '   ')).toBe('Tuesday 2pm');
    expect(replyAfter('Tuesday 2pm', '  Wednesday instead ')).toBe('Wednesday instead');
    expect(replyAfter('', 'x'.repeat(1500))).toHaveLength(1000);
    // The rule it mirrors, in the last definition of answer_help_request.
    const body = MIGRATION.slice(MIGRATION.lastIndexOf('create or replace function public.answer_help_request'));
    expect(body).toMatch(/reply = left\(coalesce\(nullif\(trim\(want_reply\), ''\), reply\), 1000\)/);
  });

  it('opening returns the reply, in the last definition of open_help_request', () => {
    const at = Math.max(MIGRATION.lastIndexOf('create function public.open_help_request'), MIGRATION.lastIndexOf('create or replace function public.open_help_request'));
    expect(MIGRATION.slice(at, MIGRATION.indexOf('end $$', at))).toMatch(/r\.reply/);
  });

  it('refuses a backward move before anything is sent', async () => {
    await expect(answerRequest('req', 'scheduled', 'acknowledged', '')).rejects.toThrow(/cannot be moved/);
    await expect(answerRequest('req', 'closed', 'scheduled', '')).rejects.toThrow(/cannot be moved/);
    await expect(answerRequest('req', 'sent', 'withdrawn', '')).rejects.toThrow(/cannot be moved/);
  });
});

describe('from an Action Center action to a person', () => {
  const DUE = Date.UTC(2099, 9, 14, 12);

  it('a deadline becomes course help, with the assignment and date filled in', () => {
    const seed = helpFromAction({ type: 'deadline', title: 'Problem Set 3', dueAt: DUE });
    expect(seed?.need).toBe('course');
    expect(seed?.fields.assignment).toBe('Problem Set 3');
    expect(seed?.fields.deadline).toBeTruthy();
    expect(seed?.from).toContain('Problem Set 3');
  });

  it('a path or registration action becomes advising help', () => {
    expect(helpFromAction({ type: 'path', title: 'Statistics before PSY 340' })?.need).toBe('registration');
    expect(helpFromAction({ type: 'registration', title: 'Pick backups' })?.fields).toEqual({ requirement: 'Pick backups' });
  });

  it('an action with no person to ask returns nothing, so the caller keeps its note', () => {
    expect(helpFromAction({ type: 'setup', title: 'Add your courses' })).toBeNull();
    expect(helpFromAction({ type: 'something-new', title: 'x' })).toBeNull();
  });

  it('pre-fills but never pre-ticks: the seed carries values, not consent', () => {
    const seed = helpFromAction({ type: 'deadline', title: 'PS3', dueAt: DUE })!;
    const d = { ...emptyDraft(), question: 'Stuck', fields: seed.fields };
    expect(payload(d)).toEqual({ question: 'Stuck', context: {} });
  });

  it('every pre-filled key is in the vocabulary', () => {
    for (const type of ['deadline', 'study', 'path', 'registration']) {
      const seed = helpFromAction({ type, title: 't', dueAt: DUE })!;
      for (const key of Object.keys(seed.fields)) expect(CONTEXT_KEYS).toContain(key);
    }
  });

  it('hands the seed over once, and navigates only when there is a person to ask', () => {
    let went = 0;
    expect(askForHelp({ type: 'setup', title: 'x' }, () => went++)).toBe(false);
    expect(went).toBe(0);
    expect(helpSeedWaiting()).toBe(false);

    expect(askForHelp({ type: 'deadline', title: 'PS3' }, () => went++)).toBe(true);
    expect(went).toBe(1);
    expect(helpSeedWaiting()).toBe(true);
    expect(takeHelpSeed()?.fields.assignment).toBe('PS3');
    expect(takeHelpSeed()).toBeNull();
    expect(helpSeedWaiting()).toBe(false);
  });
});

describe('a seed from another screen', () => {
  it('carries the student’s own sentence as the question, once', () => {
    let went = 0;
    seedHelp({ need: 'registration', from: 'From “Describe the problem” on Help', fields: {}, question: 'I cannot register and the portal says HOLD' }, () => { went += 1; });
    expect(went).toBe(1);
    const seed = takeHelpSeed();
    expect(seed?.need).toBe('registration');
    expect(seed?.question).toBe('I cannot register and the portal says HOLD');
    expect(takeHelpSeed()).toBeNull();
  });
});
