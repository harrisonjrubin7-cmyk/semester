import { describe, expect, it } from 'vitest';
import {
  FULL,
  HOLD,
  LETTERS,
  LOUD,
  QUIET,
  RECENT,
  ROOMY,
  SILENT,
  codeOf,
  elapsed,
  grid,
  linkTo,
  load,
  nameFor,
  newCode,
  normaliseCode,
  ordered,
  spelled,
  spotlight,
  talk,
  validCode,
  whereFor,
  type Peer,
} from './call';

/** A random that walks a fixed list, so a code is a known string. */
function rolls(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('the code', () => {
  it('is three, four and three, out of the alphabet it names', () => {
    const code = newCode(rolls([0]));
    expect(code).toBe('bbb-bbbb-bbb');
    expect(validCode(code)).toBe(true);
  });

  it('draws from the whole alphabet', () => {
    // The last letter of LETTERS is reachable — an off-by-one in the index
    // would silently make one letter impossible and nothing else would say so.
    const nearly = (LETTERS.length - 1) / LETTERS.length;
    expect(newCode(rolls([nearly]))).toBe('zzz-zzzz-zzz');
  });

  it('has no vowel in it, so a code cannot spell a word', () => {
    for (const vowel of ['a', 'e', 'i', 'o', 'u', 'l']) {
      expect(LETTERS, vowel).not.toContain(vowel);
    }
  });

  it('refuses anything that is not one', () => {
    expect(validCode('bcd-fghj-km')).toBe(false);
    expect(validCode('bcdfghjkmn')).toBe(false);
    expect(validCode('abc-defg-hij')).toBe(false); // vowels
    expect(validCode('')).toBe(false);
  });
});

describe('reading a code back', () => {
  const code = 'bcd-fghj-kmn';

  it('takes it as written', () => {
    expect(normaliseCode(code)).toBe(code);
  });

  it('takes it without the hyphens, and with a phone’s capital on the front', () => {
    expect(normaliseCode('bcdfghjkmn')).toBe(code);
    expect(normaliseCode('Bcd-Fghj-Kmn')).toBe(code);
    expect(normaliseCode('  bcd fghj kmn  ')).toBe(code);
  });

  it('takes it out of the link, whose origin is also made of letters', () => {
    expect(normaliseCode(`https://harrisonjrubin7-cmyk.github.io/semester/#/call/${code}`)).toBe(code);
  });

  it('takes it out of the middle of a sentence', () => {
    expect(normaliseCode(`join ${code} at four, I will be late`)).toBe(code);
  });

  it('comes back empty for anything else', () => {
    expect(normaliseCode('')).toBe('');
    expect(normaliseCode('bcdfghjkm')).toBe('');
    expect(normaliseCode('see you at Sarratt')).toBe('');
  });
});

describe('the strict read, for prose', () => {
  it('finds a code written out', () => {
    expect(spelled('Call · bcd-fghj-kmn')).toBe('bcd-fghj-kmn');
  });

  it('will not invent one out of a sentence with its vowels removed', () => {
    // The reason the two reads are different functions. Ten consonants in a
    // row happen in ordinary writing, and an appointment is not a call.
    const prose = 'bring the stats printout and the draft chapter';
    expect(normaliseCode(prose)).not.toBe('');
    expect(spelled(prose)).toBe('');
  });
});

describe('the link', () => {
  it('is a hash address, like every other link in this app', () => {
    expect(linkTo('bcd-fghj-kmn', 'https://example.dev/semester/')).toBe(
      'https://example.dev/semester/#/call/bcd-fghj-kmn',
    );
  });

  it('replaces a hash that is already there rather than appending to it', () => {
    expect(linkTo('bcd-fghj-kmn', 'https://example.dev/semester/#/today')).toBe(
      'https://example.dev/semester/#/call/bcd-fghj-kmn',
    );
  });

  it('round-trips through the reader', () => {
    const code = newCode(rolls([0.1, 0.3, 0.5, 0.7, 0.9, 0.2, 0.4, 0.6, 0.8, 0.05]));
    expect(normaliseCode(linkTo(code, 'https://example.dev/semester/'))).toBe(code);
  });
});

describe('what a mesh costs', () => {
  it('counts the streams each person carries', () => {
    expect(load(1)).toMatchObject({ each: 0, total: 0 });
    expect(load(4)).toMatchObject({ each: 3, total: 12 });
    expect(load(8)).toMatchObject({ each: 7, total: 56 });
  });

  it('says when it is getting tight, before it is full', () => {
    expect(load(ROOMY).tight).toBe(false);
    expect(load(ROOMY + 1).tight).toBe(true);
    expect(load(FULL - 1).full).toBe(false);
    expect(load(FULL).full).toBe(true);
  });

  it('does not go negative on an empty room', () => {
    expect(load(0)).toMatchObject({ each: 0, total: 0 });
  });
});

describe('the gallery', () => {
  it('gives one tile the whole box', () => {
    const one = grid(1, { width: 1600, height: 900 });
    expect(one.cols).toBe(1);
    expect(one.rows).toBe(1);
    expect(Math.round(one.width)).toBe(1600);
  });

  it('goes two by two on a laptop and one by four on a phone', () => {
    // The whole reason this takes the box and not just the count.
    expect(grid(4, { width: 1280, height: 800 })).toMatchObject({ cols: 2, rows: 2 });
    expect(grid(4, { width: 390, height: 700 })).toMatchObject({ cols: 1, rows: 4 });
  });

  it('keeps every tile at the camera’s shape', () => {
    for (const n of [1, 2, 3, 5, 7, 9, 12]) {
      const g = grid(n, { width: 1280, height: 800 });
      expect(g.width / g.height, `${n} tiles`).toBeCloseTo(16 / 9, 5);
    }
  });

  it('fits inside the box, gaps and all', () => {
    const gap = 8;
    for (const n of [2, 3, 6, 11]) {
      const g = grid(n, { width: 1000, height: 620 }, 16 / 9, gap);
      expect(g.cols * g.width + gap * (g.cols - 1), `${n} across`).toBeLessThanOrEqual(1000.001);
      expect(g.rows * g.height + gap * (g.rows - 1), `${n} down`).toBeLessThanOrEqual(620.001);
      expect(g.cols * g.rows).toBeGreaterThanOrEqual(n);
    }
  });

  it('never packs more cells than it needs a row for', () => {
    const g = grid(5, { width: 1280, height: 800 });
    expect(g.cols * g.rows).toBeGreaterThanOrEqual(5);
    expect((g.cols - 1) * g.rows).toBeLessThan(5);
  });

  it('answers nothing for nobody, and for a box with no size yet', () => {
    expect(grid(0, { width: 900, height: 600 })).toMatchObject({ cols: 0, rows: 0 });
    expect(grid(4, { width: 0, height: 0 })).toMatchObject({ cols: 0, rows: 0 });
  });
});

const NOW = 1_700_000_000_000;

function peer(over: Partial<Peer> & { id: string }): Peer {
  return {
    name: over.id,
    joinedAt: NOW - 60_000,
    camera: true,
    muted: false,
    hand: 0,
    sharing: false,
    spokeAt: 0,
    ...over,
  };
}

describe('the order tiles are drawn in', () => {
  const who = (list: Peer[]) => ordered(list, NOW).map((p) => p.id);

  it('keeps the order people arrived when nothing else is happening', () => {
    const list = [
      peer({ id: 'c', joinedAt: NOW - 10_000 }),
      peer({ id: 'a', joinedAt: NOW - 90_000 }),
      peer({ id: 'b', joinedAt: NOW - 50_000 }),
    ];
    expect(who(list)).toEqual(['a', 'b', 'c']);
  });

  it('puts a shared screen first', () => {
    const list = [peer({ id: 'a' }), peer({ id: 'b', sharing: true, joinedAt: NOW })];
    expect(who(list)).toEqual(['b', 'a']);
  });

  it('puts a pinned tile above even that', () => {
    const list = [peer({ id: 'a' }), peer({ id: 'b', sharing: true })];
    expect(ordered(list, NOW, 'a').map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('queues hands oldest first, and above whoever is talking', () => {
    const list = [
      peer({ id: 'talker', spokeAt: NOW - 500 }),
      peer({ id: 'late', hand: NOW - 5_000 }),
      peer({ id: 'early', hand: NOW - 30_000 }),
    ];
    expect(who(list)).toEqual(['early', 'late', 'talker']);
  });

  it('puts whoever spoke most recently above whoever spoke a while ago', () => {
    const list = [
      peer({ id: 'older', spokeAt: NOW - 20_000 }),
      peer({ id: 'newer', spokeAt: NOW - 1_000 }),
      peer({ id: 'silent' }),
    ];
    expect(who(list)).toEqual(['newer', 'older', 'silent']);
  });

  it('forgets that somebody spoke once it is no longer recent', () => {
    const list = [
      peer({ id: 'a', joinedAt: NOW - 10_000, spokeAt: NOW - RECENT - 1 }),
      peer({ id: 'b', joinedAt: NOW - 90_000 }),
    ];
    expect(who(list)).toEqual(['b', 'a']);
  });

  it('sinks a camera that is off', () => {
    const list = [peer({ id: 'dark', camera: false, joinedAt: NOW - 90_000 }), peer({ id: 'lit' })];
    expect(who(list)).toEqual(['lit', 'dark']);
  });

  it('sinks you below anybody you tie with', () => {
    const list = [
      peer({ id: 'me', self: true, joinedAt: NOW - 90_000 }),
      peer({ id: 'them', joinedAt: NOW - 90_000 }),
    ];
    expect(who(list)).toEqual(['them', 'me']);
  });

  it('does not change the array it was handed', () => {
    const list = [peer({ id: 'b', joinedAt: NOW }), peer({ id: 'a', joinedAt: NOW - 1 })];
    ordered(list, NOW);
    expect(list.map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('the big tile', () => {
  it('is nothing in an empty call', () => {
    expect(spotlight([], NOW)).toBeNull();
  });

  it('is you when you are the only one here', () => {
    expect(spotlight([peer({ id: 'me', self: true })], NOW)?.id).toBe('me');
  });

  it('is never a mirror while somebody else is in the call', () => {
    const list = [peer({ id: 'me', self: true, spokeAt: NOW }), peer({ id: 'them' })];
    expect(spotlight(list, NOW)?.id).toBe('them');
  });

  it('is you if you asked for it', () => {
    const list = [peer({ id: 'me', self: true }), peer({ id: 'them', spokeAt: NOW })];
    expect(spotlight(list, NOW, 'me')?.id).toBe('me');
  });
});

describe('who is talking', () => {
  it('starts only once it is properly loud', () => {
    expect(talk(SILENT, QUIET, NOW).speaking).toBe(false);
    expect(talk(SILENT, LOUD - 0.001, NOW).speaking).toBe(false);
    expect(talk(SILENT, LOUD, NOW).speaking).toBe(true);
  });

  it('keeps the start time across a run of loud frames', () => {
    const started = talk(SILENT, LOUD, NOW);
    const later = talk(started, LOUD, NOW + 400);
    expect(later.since).toBe(NOW);
  });

  it('holds through the gap between two words', () => {
    // The hold runs from the last sound, not from the start of the sentence:
    // timed from the start, a long answer switches itself off mid-clause.
    const on = talk(SILENT, LOUD, NOW);
    const quiet = talk(on, 0, NOW + 100);
    expect(quiet.speaking).toBe(true);
    expect(talk(quiet, 0, NOW + HOLD - 1).speaking).toBe(true);
    expect(talk(quiet, 0, NOW + HOLD).speaking).toBe(false);
  });

  it('does not restart the hold on every quiet frame', () => {
    // The bug this shape avoids: stamping `since` on each quiet sample means
    // the hold never expires and a talker never stops talking.
    let state = talk(SILENT, LOUD, NOW);
    for (let t = 10; t < HOLD; t += 10) state = talk(state, 0, NOW + t);
    expect(talk(state, 0, NOW + HOLD).speaking).toBe(false);
  });

  it('stays on while the level is merely middling', () => {
    // Between the two thresholds is "still talking", which is what stops the
    // ring strobing on consonants.
    const on = talk(SILENT, LOUD, NOW);
    expect(talk(on, (LOUD + QUIET) / 2, NOW + 5_000).speaking).toBe(true);
  });
});

describe('how long it has been', () => {
  it('counts up in minutes, and finds an hour when there is one', () => {
    expect(elapsed(0)).toBe('0:00');
    expect(elapsed(7_400)).toBe('0:07');
    expect(elapsed(12 * 60_000 + 34_000)).toBe('12:34');
    expect(elapsed(3_600_000 + 2 * 60_000 + 3_000)).toBe('1:02:03');
  });

  it('does not go backwards before the call started', () => {
    expect(elapsed(-5_000)).toBe('0:00');
  });
});

describe('a scheduled call is an appointment', () => {
  it('writes the code where the place goes', () => {
    expect(whereFor('bcd-fghj-kmn')).toBe('Call · bcd-fghj-kmn');
  });

  it('reads it back off one', () => {
    expect(codeOf({ where: whereFor('bcd-fghj-kmn'), note: '' })).toBe('bcd-fghj-kmn');
  });

  it('finds one somebody typed into the note instead', () => {
    expect(codeOf({ where: 'Zoom', note: 'link: bcd-fghj-kmn' })).toBe('bcd-fghj-kmn');
  });

  it('leaves an ordinary appointment alone', () => {
    expect(codeOf({ where: 'Central Library, 4th floor', note: 'bring the printout' })).toBe('');
    expect(codeOf({})).toBe('');
  });
});

describe('what a call is called', () => {
  it('takes the course code, because that is what you will look for', () => {
    expect(nameFor('ECON 1020')).toBe('ECON 1020 study call');
  });

  it('says something rather than nothing when there is no course', () => {
    expect(nameFor('  ')).toBe('Study call');
  });
});
