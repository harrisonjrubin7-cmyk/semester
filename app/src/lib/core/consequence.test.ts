import { describe, expect, it } from 'vitest';
import { RECOVERY, pattern } from './consequence';

describe('consequence pattern', () => {
  it('a reversible, private, local action is undo', () => {
    expect(pattern({ reversible: true })).toBe('undo');
  });
  it('leaving Semester or affecting others previews first', () => {
    expect(pattern({ reversible: true, leavesSemester: true })).toBe('preview');
    expect(pattern({ reversible: true, affectsOthers: true })).toBe('preview');
  });
  it('an irreversible action without a record or money is previewed, not confirmed', () => {
    expect(pattern({ reversible: false })).toBe('preview');
  });
  it('a record or money needs review and confirm', () => {
    expect(pattern({ reversible: false, record: true })).toBe('review-confirm');
    expect(pattern({ reversible: true, money: 25 })).toBe('review-confirm');
  });
  it('money moving out is as consequential as money moving in', () => {
    expect(pattern({ reversible: true, money: -25 })).toBe('review-confirm');
  });
  it('zero money is not money', () => {
    expect(pattern({ reversible: true, money: 0 })).toBe('undo');
  });
  it('an institutional action is always two-person, whatever else it is', () => {
    expect(pattern({ reversible: false, institutional: true })).toBe('two-person');
    expect(pattern({ reversible: true, institutional: true, money: 10 })).toBe('two-person');
  });
  it('recovery copy is stated for each reversibility level', () => {
    expect(RECOVERY.undo).toBe('You can undo this.');
    expect(RECOVERY.none).toBe('This can’t be undone.');
  });
});
