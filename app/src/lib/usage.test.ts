import { describe, expect, it } from 'vitest';
import { USAGE_KEY, neverOpened, note, read, top, total, unusedLine, usageLine } from './usage';
import { NOTHING_YET, type Facts } from './reveal';
import { DEFAULT_PERSISTED } from '../state/shape';

describe('counting an open', () => {
  it('starts a screen at one and goes up', () => {
    let c = note({}, 'today');
    expect(c.today).toBe(1);
    c = note(c, 'today');
    expect(c.today).toBe(2);
  });

  it('leaves the counts it was given alone', () => {
    const before = { today: 1 };
    note(before, 'today');
    expect(before.today).toBe(1);
  });

  it('ignores a screen with no name rather than counting an empty one', () => {
    expect(note({}, '')).toEqual({});
  });
});

describe('what it records, and what it deliberately does not', () => {
  it('is a number per screen and nothing else', () => {
    // Not when, not in what order, not for how long. A sequence of screens
    // with times on it is a record of somebody's day; a total answers "is
    // anyone using the essay tool" just as well.
    const c = note(note({}, 'essay'), 'today');
    for (const v of Object.values(c)) expect(typeof v).toBe('number');
  });

  it('lives in its own key, outside everything that syncs', () => {
    expect(USAGE_KEY).toBe('semester.usage');
    expect(Object.keys(DEFAULT_PERSISTED)).not.toContain('usage');
  });

  it('is not something progressive disclosure could read', () => {
    // `reveal.ts` gates on facts about the semester, never on how much the app
    // has been used. Nothing in its inputs could hold a count.
    const facts: Facts = { ...NOTHING_YET };
    for (const k of Object.keys(facts)) expect(k).not.toMatch(/usage|opens|count/i);
  });
});

describe('reading back what is stored', () => {
  it('survives nothing, rubbish, and the wrong shape', () => {
    expect(read(null)).toEqual({});
    expect(read('not json')).toEqual({});
    expect(read('[1,2,3]')).toEqual({});
    expect(read('"today"')).toEqual({});
  });

  it('drops entries that are not counts', () => {
    expect(read('{"a":3,"b":"lots","c":-1,"d":0,"e":null}')).toEqual({ a: 3 });
  });

  it('rounds a fraction down rather than carrying it', () => {
    expect(read('{"a":3.7}')).toEqual({ a: 3 });
  });
});

describe('what it can tell you', () => {
  const counts = { today: 40, study: 12, essay: 1, meals: 12 };

  it('names the screens you actually use', () => {
    expect(top(counts, 2).map((t) => t.screen)).toEqual(['today', 'meals']);
  });

  it('breaks a tie the same way every time', () => {
    expect(top(counts).map((t) => t.screen)).toEqual(['today', 'meals', 'study', 'essay']);
  });

  it('names the ones you never opened', () => {
    expect(neverOpened(counts, ['today', 'housing', 'runway'])).toEqual(['housing', 'runway']);
  });

  it('counts the lot', () => {
    expect(total(counts)).toBe(65);
    expect(total({})).toBe(0);
  });
});

describe('what it says about itself', () => {
  it('names the key, so somebody can go and look', () => {
    expect(usageLine(true, {})).toContain('semester.usage');
  });

  it('says where the numbers go, which is nowhere', () => {
    expect(usageLine(true, {})).toContain('never uploaded');
    expect(usageLine(true, { today: 2 })).toContain('never uploaded');
  });

  it('does not say the empty thing', () => {
    const said = `${usageLine(true, { a: 1 })} ${usageLine(false, {})}`.toLowerCase();
    for (const word of ['anonymous usage data', 'improve your experience', 'help us']) {
      expect(said, word).not.toContain(word);
    }
  });

  it('says what switching it off does not do', () => {
    // The obvious worry: does turning this off take my screens away? It does
    // not, and the answer belongs in the sentence rather than in a support
    // thread.
    expect(usageLine(false, {})).toContain('stay unlocked');
  });

  it('counts one open as one', () => {
    expect(usageLine(true, { a: 1 })).toContain('1 screen open');
    expect(usageLine(true, { a: 2 })).toContain('2 screen opens');
  });

  it('says nothing when there are no screens to talk about', () => {
    expect(unusedLine(0, 0)).toBe('');
  });

  it('says so when you have been everywhere', () => {
    expect(unusedLine(0, 40)).toContain('every screen');
  });

  it('offers the thing that acts on the answer', () => {
    expect(unusedLine(14, 40)).toContain('14 of 40');
    expect(unusedLine(14, 40)).toMatch(/earned/i);
  });
});
