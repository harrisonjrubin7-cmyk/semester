import { describe, expect, it } from 'vitest';
import { longMargins } from './margins';

describe('longMargins', () => {
  it('leaves a style with no margin shorthand exactly as it was', () => {
    const style = { fontSize: '12px', marginBottom: '4px' };
    expect(longMargins(style)).toBe(style);
  });

  it('expands one value to all four sides', () => {
    expect(longMargins({ margin: '8px' })).toEqual({
      marginTop: '8px',
      marginRight: '8px',
      marginBottom: '8px',
      marginLeft: '8px',
    });
  });

  it('expands two values to block and inline', () => {
    expect(longMargins({ margin: '8px 12px' })).toEqual({
      marginTop: '8px',
      marginRight: '12px',
      marginBottom: '8px',
      marginLeft: '12px',
    });
  });

  it('expands three values, repeating the sides', () => {
    expect(longMargins({ margin: '20px 0 6px' })).toEqual({
      marginTop: '20px',
      marginRight: '0',
      marginBottom: '6px',
      marginLeft: '0',
    });
  });

  it('expands four values in order', () => {
    expect(longMargins({ margin: '1px 2px 3px 4px' })).toEqual({
      marginTop: '1px',
      marginRight: '2px',
      marginBottom: '3px',
      marginLeft: '4px',
    });
  });

  /*
   * The case the whole file is for. `SectionLabel`'s own margin is written
   * with `calc()` and `var()`, both of which hold spaces, so a split on
   * whitespace reads three values as seven and gives up.
   */
  it('does not split inside calc() or var()', () => {
    expect(
      longMargins({
        margin: 'calc(26px * var(--density, 1)) 0 calc(12px * var(--density, 1))',
      }),
    ).toEqual({
      marginTop: 'calc(26px * var(--density, 1))',
      marginRight: '0',
      marginBottom: 'calc(12px * var(--density, 1))',
      marginLeft: '0',
    });
  });

  it('keeps a numeric margin a number, so React still reads it as pixels', () => {
    expect(longMargins({ margin: 8 })).toEqual({
      marginTop: 8,
      marginRight: 8,
      marginBottom: 8,
      marginLeft: 8,
    });
  });

  /*
   * The collision itself: a shorthand and one of its own longhands in the
   * same object is what React warns about, and what silently wiped a
   * heading's margins on the second fold. The longhand has to survive the
   * split and the shorthand has to be gone.
   */
  it('lets an explicit side win over the shorthand it came with', () => {
    const out = longMargins({ margin: '22px 0 8px', marginBottom: 'var(--sp-3)' });
    expect(out).toEqual({
      marginTop: '22px',
      marginRight: '0',
      marginBottom: 'var(--sp-3)',
      marginLeft: '0',
    });
    expect('margin' in out).toBe(false);
  });

  it('leaves a global keyword alone rather than approximating it', () => {
    const style = { margin: 'inherit' };
    expect(longMargins(style)).toBe(style);
  });
});
