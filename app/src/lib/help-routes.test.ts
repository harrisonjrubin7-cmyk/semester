import { readFileSync } from 'node:fs';
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

const MIGRATION = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260927180000_help_requests.sql'),
  'utf8',
);

/** The quoted words inside the first `(...)` after `marker`. */
function quotedAfter(marker: string): string[] {
  const at = MIGRATION.indexOf(marker);
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
    const body = MIGRATION.slice(MIGRATION.indexOf('function public.answer_help_request'));
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
});
