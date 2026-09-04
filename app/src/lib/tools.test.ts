import { describe, expect, it } from 'vitest';
import { proposalsLine, readProposal, TOOLS } from './tools';
import type { ToolCall } from './claude';

const known = {
  deadlines: [
    { id: 'econ-ps4', title: 'Problem Set 4' },
    { id: 'core-r2', title: 'Reflection #2' },
  ],
};

const call = (name: string, input: Record<string, unknown>): ToolCall => ({
  id: 'toolu_1',
  name,
  input,
});

describe('what it is allowed to offer', () => {
  it('offers three things and nothing destructive', () => {
    // No deleting a course, editing a grade or spending money. The cost of
    // the model getting one of those wrong is not worth it getting them right.
    expect(TOOLS.map((t) => t.name).sort()).toEqual(['add_task', 'open_screen', 'tick_deadline']);
  });

  it('asks the API to guarantee the arguments validate', () => {
    expect(TOOLS.every((t) => t.strict === true)).toBe(true);
  });
});

describe('ticking a deadline', () => {
  it('describes exactly what the button will do', () => {
    const p = readProposal(call('tick_deadline', { id: 'econ-ps4', title: 'PS4' }), known);
    expect(p?.said).toBe('Tick off “Problem Set 4” as done');
    expect(p?.action).toEqual({ type: 'toggleDone', id: 'econ-ps4' });
  });

  it('uses the app’s title, not the model’s', () => {
    // The model passed "PS4"; the app holds "Problem Set 4". The student is
    // confirming against what the app will actually change.
    const p = readProposal(call('tick_deadline', { id: 'econ-ps4', title: 'PS4' }), known);
    expect(p?.said).toContain('Problem Set 4');
    expect(p?.said).not.toContain('PS4');
  });

  it('refuses an id the app does not hold', () => {
    // Otherwise the button ticks nothing and reports success.
    expect(readProposal(call('tick_deadline', { id: 'invented', title: 'x' }), known)).toBeNull();
    expect(readProposal(call('tick_deadline', {}), known)).toBeNull();
  });
});

describe('adding a task', () => {
  it('carries a date it can read', () => {
    const p = readProposal(call('add_task', { title: 'Email Dr Stromme', date: '2026-09-14' }), known);
    expect(p?.said).toBe('Add “Email Dr Stromme” to your list for 2026-09-14');
    expect(p?.action).toEqual({
      type: 'addTask',
      task: { title: 'Email Dr Stromme', date: '2026-09-14', time: '', note: '', courseId: null },
    });
  });

  it('drops a date it cannot', () => {
    // Undated is a real state. A date the app cannot parse would land the
    // task on a day nobody chose.
    const p = readProposal(call('add_task', { title: 'Email him', date: 'next Friday' }), known);
    expect(p?.said).toBe('Add “Email him” to your list');
    expect((p?.action as { task: { date: null } }).task.date).toBeNull();
  });

  it('refuses a task with nothing in it', () => {
    expect(readProposal(call('add_task', { title: '   ', date: '' }), known)).toBeNull();
  });
});

describe('opening a screen', () => {
  it('names the screen the way a person would', () => {
    const p = readProposal(
      call('open_screen', { screen: 'runway', why: 'it counts back from the exam' }),
      known,
    );
    expect(p?.said).toBe('Open the exam runway — it counts back from the exam');
    expect(p?.action).toEqual({ type: 'go', screen: 'runway' });
  });

  it('refuses a screen that is not on the list', () => {
    expect(readProposal(call('open_screen', { screen: 'account', why: 'x' }), known)).toBeNull();
    expect(readProposal(call('open_screen', { screen: 'nonsense', why: 'x' }), known)).toBeNull();
  });
});

describe('a tool nobody defined', () => {
  it('produces nothing rather than a guess', () => {
    expect(readProposal(call('delete_everything', { sure: true }), known)).toBeNull();
  });
});

describe('what sits above the buttons', () => {
  it('says nothing has happened yet', () => {
    // The whole arrangement depends on the student believing that, and one
    // ambiguous moment is enough to lose it.
    const p = readProposal(call('tick_deadline', { id: 'econ-ps4', title: 'x' }), known)!;
    expect(proposalsLine([p])).toContain('nothing has happened yet');
    expect(proposalsLine([])).toBe('');
  });
});
