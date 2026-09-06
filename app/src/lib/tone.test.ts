import { describe, expect, it } from 'vitest';
import {
  TONES,
  askReminders,
  catchUp,
  overdueLine,
  punchline,
  readTone,
  slipped,
  type Tone,
} from './tone';

describe('reading the setting back', () => {
  it('takes the three it knows', () => {
    for (const t of TONES) expect(readTone(t)).toBe(t);
  });

  it('falls back to direct, which is what the app already said', () => {
    for (const junk of [undefined, null, '', 'chatty', 42, {}]) expect(readTone(junk)).toBe('direct');
  });
});

describe('the numbers never change', () => {
  it('says the same count in every tone', () => {
    for (const tone of TONES) {
      expect(punchline(5, 9, tone), tone).toContain('5');
      expect(slipped(5, tone), tone).toContain('5');
      expect(overdueLine('ECON PS4 is 6 days late', 4, tone), tone).toContain('4');
    }
  });

  it('never softens a figure into a word', () => {
    for (const tone of TONES) {
      expect(slipped(5, tone), tone).not.toMatch(/a few|some|several/i);
    }
  });
});

describe('the voice holds in every tone', () => {
  const everything = (tone: Tone) =>
    [
      punchline(0, 0, tone), punchline(0, 3, tone), punchline(1, 3, tone),
      punchline(2, 4, tone), punchline(5, 9, tone),
      overdueLine('', 0, tone), overdueLine('ECON PS4 is 6 days late', 0, tone),
      overdueLine('ECON PS4 is 6 days late', 3, tone),
      slipped(1, tone), slipped(4, tone), catchUp(tone), askReminders(tone),
    ].join(' | ');

  it('never shouts', () => {
    for (const tone of TONES) expect(everything(tone), tone).not.toMatch(/!/);
  });

  it('never cheerleads', () => {
    for (const tone of TONES) {
      expect(everything(tone), tone).not.toMatch(/great|awesome|amazing|well done|keep it up|you've got this/i);
    }
  });

  it('never says nothing', () => {
    for (const tone of TONES) {
      for (const line of everything(tone).split(' | ')) expect(line.trim(), tone).not.toBe('');
    }
  });
});

describe('direct is unchanged', () => {
  it('still says exactly what it said before the setting existed', () => {
    expect(punchline(0, 0, 'direct')).toBe('A clear day. Rare.');
    expect(punchline(0, 3, 'direct')).toBe('Day cleared.');
    expect(punchline(1, 3, 'direct')).toBe('One thing left. Finish it.');
    expect(punchline(2, 4, 'direct')).toBe('Two left. Both before midnight.');
    expect(punchline(5, 9, 'direct')).toBe('5 things stand between you and done.');
    expect(overdueLine('', 0, 'direct')).toBe('Nothing missed. Keep it that way.');
    expect(overdueLine('ECON PS4 is 6 days late', 2, 'direct')).toBe(
      'ECON PS4 is 6 days late, and 2 others went by.',
    );
    expect(catchUp('direct')).toBe('Sort out what still matters');
    expect(askReminders('direct')).toBe('When should I bug you?');
  });
});

describe('supportive drops the verdict, not the fact', () => {
  it('says still open rather than went by', () => {
    expect(slipped(5, 'supportive')).toBe('5 things still open');
    expect(overdueLine('ECON PS4 is 6 days late', 2, 'supportive')).toBe(
      'ECON PS4 is 6 days late, and 2 others still open.',
    );
  });

  it('drops the instruction from the headline', () => {
    expect(punchline(1, 3, 'supportive')).toBe('One thing left today.');
    expect(punchline(1, 3, 'supportive')).not.toMatch(/finish it/i);
  });

  it('does not call an empty day rare', () => {
    // "A clear day. Rare." is a joke at the expense of somebody's semester.
    expect(punchline(0, 0, 'supportive')).toBe('Nothing due today.');
  });
});

describe('minimal says the count and stops', () => {
  it('is shorter than the other two, every time', () => {
    for (const [l, t] of [[5, 9], [1, 3], [0, 0], [0, 4]] as const) {
      expect(punchline(l, t, 'minimal').length, `${l}/${t}`).toBeLessThanOrEqual(
        punchline(l, t, 'direct').length,
      );
    }
  });

  it('still names the overdue thing, because a name is actionable', () => {
    expect(overdueLine('ECON PS4 is 6 days late', 3, 'minimal')).toBe('ECON PS4 is 6 days late. +3.');
  });
});

describe('pluralisation', () => {
  it('reads properly for one and for many', () => {
    expect(slipped(1, 'direct')).toBe('1 thing went by');
    expect(slipped(2, 'direct')).toBe('2 things went by');
    expect(slipped(1, 'supportive')).toBe('1 thing still open');
    expect(overdueLine('x', 1, 'direct')).toBe('x, and 1 other went by.');
    expect(overdueLine('x', 2, 'supportive')).toBe('x, and 2 others still open.');
  });
});
