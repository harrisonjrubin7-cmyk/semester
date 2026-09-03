import { describe, expect, it } from 'vitest';
import { DEFAULT_ORDER, move, ordered, visible } from './feed';

describe('ordered', () => {
  it('gives the default order when nothing is saved', () => {
    expect(ordered(undefined)).toEqual(DEFAULT_ORDER);
    expect(ordered([])).toEqual(DEFAULT_ORDER);
  });

  it('keeps a saved order', () => {
    expect(ordered(['rail', 'due'])[0]).toBe('rail');
    expect(ordered(['rail', 'due'])[1]).toBe('due');
    expect(ordered(['rail', 'due'])).toHaveLength(DEFAULT_ORDER.length);
  });

  it('appends a section the saved order has never heard of', () => {
    // Otherwise a version that adds a section hides it from everyone who has
    // ever opened the settings — reported as "the app lost my tasks".
    const out = ordered(['rail']);
    expect(out).toHaveLength(DEFAULT_ORDER.length);
    for (const id of DEFAULT_ORDER) expect(out).toContain(id);
  });

  it('drops a section that no longer exists', () => {
    expect(ordered(['gone', 'rail'])).not.toContain('gone');
  });

  it('does not list the same section twice', () => {
    expect(ordered(['rail', 'rail', 'due'])).toHaveLength(DEFAULT_ORDER.length);
  });
});

describe('visible', () => {
  it('leaves out what is hidden, keeping the rest in order', () => {
    const out = visible(['rail', 'due', 'next'], { due: true });
    expect(out[0]).toBe('rail');
    expect(out).not.toContain('due');
  });

  it('can hide everything without breaking', () => {
    const all = Object.fromEntries(DEFAULT_ORDER.map((id) => [id, true]));
    expect(visible(undefined, all)).toEqual([]);
  });
});

describe('move', () => {
  it('swaps with the neighbour', () => {
    const out = move(DEFAULT_ORDER, 'due', -1);
    expect(out[0]).toBe('due');
    expect(out[1]).toBe('next');
  });

  it('stops at the ends rather than wrapping', () => {
    // Wrapping is a delight in a carousel and a bug in a list: one press too
    // many and the thing you were promoting is suddenly last.
    expect(move(DEFAULT_ORDER, DEFAULT_ORDER[0], -1)).toEqual(DEFAULT_ORDER);
    expect(move(DEFAULT_ORDER, DEFAULT_ORDER[DEFAULT_ORDER.length - 1], 1)).toEqual(DEFAULT_ORDER);
  });

  it('ignores a section it does not know', () => {
    expect(move(DEFAULT_ORDER, 'nonsense', 1)).toEqual(DEFAULT_ORDER);
  });

  it('does not mutate the list it was given', () => {
    const given = [...DEFAULT_ORDER];
    move(given, 'due', 1);
    expect(given).toEqual(DEFAULT_ORDER);
  });

  it('keeps every section after a move', () => {
    const out = move(DEFAULT_ORDER, 'rail', -1);
    expect([...out].sort()).toEqual([...DEFAULT_ORDER].sort());
  });
});
