import { describe, expect, it } from 'vitest';
import { EVENT_KINDS, blockLabel } from './kinds';

describe('blockLabel', () => {
  it('names the kind, which the tinted border carries and nothing else', () => {
    expect(blockLabel('Standup', 'work', '9:00')).toBe('Standup. Work. 9:00.');
    expect(blockLabel('Gym', 'health', '6:30')).toBe('Gym. Health. 6:30.');
  });

  it('calls a null kind a class — the one kind that comes from a syllabus', () => {
    expect(blockLabel('ECON 1020', null, '9:05')).toBe('ECON 1020. Class. 9:05.');
    expect(blockLabel('ECON 1020', undefined, '9:05')).toBe('ECON 1020. Class. 9:05.');
  });

  it('includes the meta line when there is one', () => {
    expect(blockLabel('ECON 1020', null, '9:05', 'Buttrick 101')).toBe(
      'ECON 1020. Class. 9:05. Buttrick 101.',
    );
  });

  it('says cancelled, which was a line-through and an opacity', () => {
    expect(blockLabel('ECON 1020', null, '9:05', '', true)).toBe(
      'ECON 1020. Class. 9:05. Cancelled.',
    );
  });

  it('gives every event kind words, so none is colour alone', () => {
    for (const k of EVENT_KINDS) {
      expect(blockLabel('x', k.id, '1:00'), k.id).toContain(k.label);
    }
  });
});
