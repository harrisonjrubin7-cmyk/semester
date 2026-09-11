import { describe, expect, it } from 'vitest';
import { COALESCE, DEEPEST, canRedo, canUndo, now, push, redo, start, undo } from './history';

/**
 * The editor's undo.
 *
 * Each test here is a way the naive version of this gets it wrong: one step
 * per keystroke, a redo that survives a new branch, or a buffer that drops the
 * oldest entry and leaves the finger pointing at the wrong one.
 */
describe('an editing history', () => {
  it('starts on what the editor opened with and can go nowhere', () => {
    const h = start('a');
    expect(now(h)).toBe('a');
    expect(canUndo(h)).toBe(false);
    expect(canRedo(h)).toBe(false);
  });

  it('takes one step back and forward again', () => {
    let h = start('a');
    h = push(h, 'b', 'b4', 1000);
    expect(now(h)).toBe('b');
    h = undo(h);
    expect(now(h)).toBe('a');
    expect(canRedo(h)).toBe(true);
    h = redo(h);
    expect(now(h)).toBe('b');
  });

  it('makes a run of typing one step, not one per keystroke', () => {
    // Twelve presses to take back a word is an undo nobody uses.
    let h = start('');
    h = push(h, 'M', 'type:B4', 1000);
    h = push(h, 'Mi', 'type:B4', 1100);
    h = push(h, 'Mid', 'type:B4', 1200);
    expect(h.past).toHaveLength(2);
    expect(now(undo(h))).toBe('');
  });

  it('starts a new step when the typing moves to another cell', () => {
    let h = start('');
    h = push(h, 'a', 'type:B4', 1000);
    h = push(h, 'ab', 'type:C4', 1100);
    expect(h.past).toHaveLength(3);
  });

  it('starts a new step when the pause is long enough', () => {
    let h = start('');
    h = push(h, 'a', 'type:B4', 1000);
    h = push(h, 'ab', 'type:B4', 1000 + COALESCE + 1);
    expect(h.past).toHaveLength(3);
  });

  it('does not coalesce an untagged change into the one before it', () => {
    let h = start('');
    h = push(h, 'a', '', 1000);
    h = push(h, 'b', '', 1010);
    expect(h.past).toHaveLength(3);
  });

  it('throws the redo away when a new change arrives', () => {
    let h = start('a');
    h = push(h, 'b', 'x', 1000);
    h = push(h, 'c', 'y', 3000);
    h = undo(h);
    h = undo(h);
    expect(now(h)).toBe('a');
    h = push(h, 'd', 'z', 5000);
    expect(canRedo(h)).toBe(false);
    expect(now(h)).toBe('d');
    expect(now(undo(h))).toBe('a');
  });

  it('does not coalesce into the step it has just undone back to', () => {
    // Undo, then type: the typing must be its own step, or pressing undo a
    // second time would go back past the thing just restored.
    let h = start('a');
    h = push(h, 'b', 'type:B4', 1000);
    h = undo(h);
    h = push(h, 'c', 'type:B4', 1100);
    expect(h.past).toHaveLength(2);
    expect(now(undo(h))).toBe('a');
  });

  it('keeps the finger on the newest entry when the oldest falls off', () => {
    let h = start(0);
    for (let i = 1; i <= DEEPEST + 10; i += 1) h = push(h, i, `s${i}`, i * 10_000);
    expect(h.past).toHaveLength(DEEPEST);
    expect(now(h)).toBe(DEEPEST + 10);
    expect(now(undo(h))).toBe(DEEPEST + 9);
  });

  it('refuses to move past either end', () => {
    const h = start('a');
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });
});
