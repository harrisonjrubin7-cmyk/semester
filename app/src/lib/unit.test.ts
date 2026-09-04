import { describe, expect, it } from 'vitest';
import { unitName } from './unit';

describe('taking the numbering off a unit name', () => {
  it('drops a leading number', () => {
    expect(unitName('0 · How to actually pass this class')).toBe(
      'How to actually pass this class',
    );
  });

  it('drops a leading pair, which is how double units are written', () => {
    expect(unitName('3/4 · Market failure')).toBe('Market failure');
  });

  it('leaves a name that has no numbering alone', () => {
    expect(unitName('Self-test')).toBe('Self-test');
  });

  it('leaves a number that is part of the name', () => {
    // `1929` is the unit, not its position in the course.
    expect(unitName('1929 and after')).toBe('1929 and after');
  });

  it('leaves a middle dot that is not a numbering separator', () => {
    expect(unitName('Supply · demand')).toBe('Supply · demand');
  });

  it('does not fall over on an empty name', () => {
    expect(unitName('')).toBe('');
  });
});
