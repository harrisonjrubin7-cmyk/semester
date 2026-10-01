import { describe, expect, it } from 'vitest';
import { answered, clock, testOfferings } from './client';

describe('which courses a person writes tests for or takes tests in', () => {
  const grants = [
    { capability: 'assessments:author', scopeKind: 'course', scopeId: 'vu/ECON 1020/2026FA' },
    { capability: 'assessments:take', scopeKind: 'course', scopeId: 'vu/HIST 2100/2027SP' },
    { capability: 'assessments:take', scopeKind: 'course', scopeId: 'vu/HIST 2100' },
    { capability: 'assessments:take', scopeKind: 'course', scopeId: 'other/ECON 1020/2026FA' },
    { capability: 'assessments:review', scopeKind: 'course', scopeId: 'vu/BUS 1600/2026FA' },
  ];
  it('reads exactly school/CODE/TERM, and only the two capabilities that mean writing and taking', () => {
    expect(testOfferings(grants, 'vu')).toEqual({ writing: [{ course: 'ECON 1020', term: '2026FA' }], taking: [{ course: 'HIST 2100', term: '2027SP' }] });
    expect(testOfferings(grants, '')).toEqual({ writing: [], taking: [] });
  });
});

describe('whether an answer holds anything', () => {
  it('counts a choice, a set, a boolean, a number and some text, and not an empty one', () => {
    expect(answered('multiple_choice', { choice: 'b' })).toBe(true);
    expect(answered('multiple_choice', { choice: '' })).toBe(false);
    expect(answered('multiple_response', { choices: ['a'] })).toBe(true);
    expect(answered('multiple_response', { choices: [] })).toBe(false);
    expect(answered('true_false', { value: false })).toBe(true);
    expect(answered('numeric', { value: 0 })).toBe(true);
    expect(answered('numeric', { value: Number.NaN })).toBe(false);
    expect(answered('short_answer', { text: '   ' })).toBe(false);
    expect(answered('essay', { text: 'x' })).toBe(true);
    expect(answered('essay', undefined)).toBe(false);
  });
});

describe('the clock', () => {
  it('shows minutes and seconds and never goes negative', () => {
    expect(clock(0)).toBe('00:00');
    expect(clock(65)).toBe('01:05');
    expect(clock(3599)).toBe('59:59');
    expect(clock(-4)).toBe('00:00');
  });
});
