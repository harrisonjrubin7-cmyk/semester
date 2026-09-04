import { describe, expect, it } from 'vitest';
import {
  SHOWN_FOR,
  TYPE_TO_CONFIRM,
  UNDOABLE,
  fresh,
  snapshot,
  tookSomething,
  typedRight,
  undoableFor,
} from './undo';
import { DEFAULT_PERSISTED, type Persisted } from '../state/shape';

const AT = 1_788_000_000_000;

const withNotes = (titles: string[]): Persisted => ({
  ...DEFAULT_PERSISTED,
  notes: titles.map((t, i) => ({
    id: `n${i}`,
    title: t,
    body: '',
    created: AT,
    updated: AT,
    courseId: null,
    fileIds: [],
  })),
});

describe('which actions can be taken back', () => {
  it('names one for every kind of removal', () => {
    expect(undoableFor('deleteNote')?.label).toBe('Note deleted');
    expect(undoableFor('dropLetter')?.fields).toEqual(['letters']);
  });

  it('has none for an action that changes nothing away', () => {
    // Ticking a box is reversible by ticking it again, and a toast after every
    // tick would be the most annoying thing in the app.
    expect(undoableFor('toggleDone')).toBeNull();
    expect(undoableFor('go')).toBeNull();
  });

  it('names fields that actually exist on the state', () => {
    // A typo here would snapshot `undefined` and restore it, quietly emptying
    // the thing it was meant to save.
    for (const [type, u] of Object.entries(UNDOABLE)) {
      for (const f of u.fields) {
        expect(f in DEFAULT_PERSISTED, `${type} names ${String(f)}`).toBe(true);
      }
    }
  });

  it('says something a person would recognise', () => {
    for (const u of Object.values(UNDOABLE)) {
      expect(u.label.length).toBeGreaterThan(3);
      expect(u.label).not.toMatch(/[A-Z]{2,}|_|\bid\b/);
    }
  });

  it('does not offer undo for the two that ask instead', () => {
    for (const type of Object.keys(TYPE_TO_CONFIRM)) {
      expect(undoableFor(type)).toBeNull();
    }
  });
});

describe('the snapshot', () => {
  it('keeps only the fields the action can damage', () => {
    // Keeping the whole state would restore *everything* — undoing a deleted
    // note would also undo the box you ticked in between.
    const took = snapshot(withNotes(['One']), UNDOABLE.deleteNote, AT);
    expect(Object.keys(took.was)).toEqual(['notes']);
    expect(took.was.notes).toHaveLength(1);
  });

  it('keeps several where one action reaches several', () => {
    const took = snapshot(DEFAULT_PERSISTED, UNDOABLE.dropPerson, AT);
    expect(Object.keys(took.was).sort()).toEqual(['letters', 'people', 'visits']);
  });

  it('carries the label and the moment', () => {
    const took = snapshot(DEFAULT_PERSISTED, UNDOABLE.deleteTask, AT);
    expect(took.label).toBe('Task deleted');
    expect(took.at).toBe(AT);
  });
});

describe('whether the action took anything', () => {
  const took = (state: Persisted) => snapshot(state, UNDOABLE.deleteNote, AT);

  it('sees a row gone', () => {
    expect(tookSomething(took(withNotes(['One', 'Two'])), withNotes(['One']))).toBe(true);
  });

  it('does not mistake a fresh array for a removal', () => {
    // Every slice returns a new `{...state}` and `.filter` allocates a new
    // array whether or not it dropped a row, so identity says "changed" for a
    // Remove pressed on an id that is already gone.
    const before = withNotes(['One', 'Two']);
    const after = { ...before, notes: before.notes.filter((n) => n.id !== 'never-existed') };
    expect(after.notes).not.toBe(before.notes);
    expect(tookSomething(took(before), after)).toBe(false);
  });

  it('sees a key gone from a record, not just a row from a list', () => {
    const before: Persisted = { ...DEFAULT_PERSISTED, done: { a: true, b: true } };
    const snap = snapshot(before, { label: 'x', fields: ['done'] }, AT);
    expect(tookSomething(snap, { ...before, done: { a: true } })).toBe(true);
    expect(tookSomething(snap, before)).toBe(false);
  });

  it('does not call an addition a removal', () => {
    expect(tookSomething(took(withNotes(['One'])), withNotes(['One', 'Two']))).toBe(false);
  });
});

describe('how long it stays offerable', () => {
  it('is offerable while the toast is up', () => {
    const took = snapshot(DEFAULT_PERSISTED, UNDOABLE.deleteNote, AT);
    expect(fresh(took, AT)).toBe(true);
    expect(fresh(took, AT + SHOWN_FOR - 1)).toBe(true);
  });

  it('is not, after', () => {
    const took = snapshot(DEFAULT_PERSISTED, UNDOABLE.deleteNote, AT);
    expect(fresh(took, AT + SHOWN_FOR)).toBe(false);
  });

  it('is not, when there is nothing', () => {
    expect(fresh(null, AT)).toBe(false);
  });
});

describe('typing to confirm', () => {
  it('forgives case and surrounding space', () => {
    // The point is that somebody read the sentence and typed the thing, not
    // that they can copy exactly.
    expect(typedRight('  econ 1020 ', 'ECON 1020')).toBe(true);
  });

  it('refuses something else', () => {
    expect(typedRight('econ', 'ECON 1020')).toBe(false);
    expect(typedRight('', 'ERASE')).toBe(false);
  });

  it('refuses everything when there is nothing to match', () => {
    // Otherwise a course with no code would be deletable by typing nothing.
    expect(typedRight('', '')).toBe(false);
    expect(typedRight('  ', '   ')).toBe(false);
  });
});
