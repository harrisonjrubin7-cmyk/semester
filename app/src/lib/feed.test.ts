import { describe, expect, it } from 'vitest';
import { ACCENTS, DEFAULT_ORDER, accent, move, ordered, scaleOf, visible } from './feed';

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

describe('accent', () => {
  it('falls back to sterling rather than to nothing', () => {
    expect(accent(undefined).id).toBe('sterling');
    expect(accent('chartreuse').id).toBe('sterling');
  });

  it('offers only desaturated metals, because the look depends on it', () => {
    // A saturated accent turns a drawn interface into a dashboard.
    for (const a of ACCENTS) {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(a.base.slice(i, i + 2), 16));
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      expect(saturation).toBeLessThan(0.35);
    }
  });
});

describe('scaleOf', () => {
  it('is 1 unless told otherwise', () => {
    expect(scaleOf(undefined)).toBe(1);
    expect(scaleOf('nonsense')).toBe(1);
    expect(scaleOf('large')).toBeGreaterThan(1);
    expect(scaleOf('compact')).toBeLessThan(1);
  });
});
