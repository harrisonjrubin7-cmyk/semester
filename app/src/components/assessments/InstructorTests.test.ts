import { describe, expect, it } from 'vitest';
import { itemFromForm } from './InstructorTests';

const F = (o: Partial<Parameters<typeof itemFromForm>[0]>) => ({ kind: 'multiple_choice' as const, stem: 'Q?', options: 'supply\nthe law of demand\ninflation', correct: 'b', points: '1', ...o });

describe('the question form builds the key the server wants', () => {
  it('a choice: lettered options and one correct letter', () => {
    expect(itemFromForm(F({}))).toEqual({
      kind: 'multiple_choice', stem: 'Q?', points: 1, key: { correct: 'b' },
      options: [{ id: 'a', text: 'supply' }, { id: 'b', text: 'the law of demand' }, { id: 'c', text: 'inflation' }],
    });
  });
  it('a set: letters, however they are separated', () => {
    expect(itemFromForm(F({ kind: 'multiple_response', correct: 'a, c' }))).toMatchObject({ key: { correct: ['a', 'c'] } });
    expect(itemFromForm(F({ kind: 'multiple_response', correct: 'a c' }))).toMatchObject({ key: { correct: ['a', 'c'] } });
  });
  it('true or false, a number with a tolerance, accepted texts, an essay', () => {
    expect(itemFromForm(F({ kind: 'true_false', correct: 'True' }))).toMatchObject({ key: { correct: true } });
    expect(itemFromForm(F({ kind: 'numeric', correct: '3.14 ± 0.01' }))).toMatchObject({ key: { value: 3.14, tolerance: 0.01 } });
    expect(itemFromForm(F({ kind: 'numeric', correct: '42' }))).toMatchObject({ key: { value: 42, tolerance: 0 } });
    expect(itemFromForm(F({ kind: 'short_answer', correct: 'supply and demand | S&D' }))).toMatchObject({ key: { accepted: ['supply and demand', 'S&D'] } });
    expect(itemFromForm(F({ kind: 'essay', correct: '' }))).toMatchObject({ kind: 'essay', key: {} });
  });
  it('says what is wrong rather than building a key that would not stand', () => {
    expect(itemFromForm(F({ stem: ' ' }))).toBe('Write the question.');
    expect(itemFromForm(F({ points: '0' }))).toBe('Points must be more than zero.');
    expect(itemFromForm(F({ options: 'only one' }))).toMatch(/at least two options/);
    expect(itemFromForm(F({ correct: 'z' }))).toMatch(/Name the correct option by its letter/);
    expect(itemFromForm(F({ correct: 'a, b' }))).toMatch(/one correct option/);
    expect(itemFromForm(F({ kind: 'true_false', correct: 'maybe' }))).toMatch(/true or false/);
    expect(itemFromForm(F({ kind: 'numeric', correct: 'pi' }))).toMatch(/as a number/);
    expect(itemFromForm(F({ kind: 'short_answer', correct: ' | ' }))).toMatch(/accepted answers/);
  });
});
