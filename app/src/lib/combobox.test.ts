import { describe, expect, it } from 'vitest';
import { comboKey, type ComboState } from './combobox';

const base: ComboState = { open: true, cursor: -1, count: 3, text: 'ec' };
const at = (over: Partial<ComboState>) => ({ ...base, ...over });

describe('comboKey', () => {
  it('opens on the first row with ArrowDown, and on the last with ArrowUp', () => {
    expect(comboKey(at({ open: false }), 'ArrowDown')).toEqual({ kind: 'move', open: true, cursor: 0 });
    expect(comboKey(at({ open: false }), 'ArrowUp')).toEqual({ kind: 'move', open: true, cursor: 2 });
  });

  it('steps through an open list and wraps at both ends', () => {
    expect(comboKey(at({ cursor: -1 }), 'ArrowDown')).toEqual({ kind: 'move', open: true, cursor: 0 });
    expect(comboKey(at({ cursor: 0 }), 'ArrowDown')).toEqual({ kind: 'move', open: true, cursor: 1 });
    expect(comboKey(at({ cursor: 2 }), 'ArrowDown')).toEqual({ kind: 'move', open: true, cursor: 0 });
    expect(comboKey(at({ cursor: 1 }), 'ArrowUp')).toEqual({ kind: 'move', open: true, cursor: 0 });
    expect(comboKey(at({ cursor: 0 }), 'ArrowUp')).toEqual({ kind: 'move', open: true, cursor: 2 });
    expect(comboKey(at({ cursor: -1 }), 'ArrowUp')).toEqual({ kind: 'move', open: true, cursor: 2 });
  });

  it('does nothing with arrows when there is nothing to offer', () => {
    expect(comboKey(at({ count: 0, open: false }), 'ArrowDown')).toEqual({ kind: 'none' });
    expect(comboKey(at({ count: 0 }), 'ArrowUp')).toEqual({ kind: 'none' });
  });

  it('chooses with Enter only when a row is the cursor — otherwise Enter is the form’s', () => {
    expect(comboKey(at({ cursor: 1 }), 'Enter')).toEqual({ kind: 'choose', index: 1 });
    expect(comboKey(at({ cursor: -1 }), 'Enter')).toEqual({ kind: 'none' });
    expect(comboKey(at({ open: false, cursor: 1 }), 'Enter')).toEqual({ kind: 'none' });
    expect(comboKey(at({ cursor: 5 }), 'Enter')).toEqual({ kind: 'none' });
  });

  it('puts the list away with the first Escape and clears the text with the second', () => {
    expect(comboKey(at({ open: true }), 'Escape')).toEqual({ kind: 'close' });
    expect(comboKey(at({ open: false }), 'Escape')).toEqual({ kind: 'clear' });
    expect(comboKey(at({ open: false, text: '' }), 'Escape')).toEqual({ kind: 'none' });
  });

  it('leaves Home, End, Tab and letters to the text box', () => {
    for (const k of ['Home', 'End', 'Tab', 'a', 'ArrowLeft', 'ArrowRight']) expect(comboKey(base, k)).toEqual({ kind: 'none' });
  });
});
