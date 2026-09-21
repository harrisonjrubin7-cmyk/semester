import { describe, expect, it } from 'vitest';
import { heardLine, readAloud, split, type Read } from './aloud';
import type { Named } from './capture';

const COURSES: Named[] = [
  { id: 'econ', code: 'ECON 1020', title: 'Principles of Microeconomics' },
  { id: 'psci', code: 'PSCI 1100', title: 'Understanding Political Controversy' },
  { id: 'core', code: 'CORE 2500', title: 'Core Seminar' },
];

// A Monday, so "friday" and "tuesday" are both ahead and unambiguous.
const now = new Date('2026-09-21T09:00:00');

const cut = (text: string) => split(text, COURSES, now).map((p) => p.text);
const seams = (text: string) => split(text, COURSES, now).map((p) => p.seam);

describe('one thing stays one thing', () => {
  it('does not cut a line that is a single item', () => {
    expect(cut('econ ps4 friday 5pm')).toEqual(['econ ps4 friday 5pm']);
  });

  it('does not cut on a plain "and"', () => {
    // "read chapters four and five" is one reading. Cutting it produces two
    // items, neither of which is true.
    expect(cut('econ read chapters four and five by friday')).toEqual([
      'econ read chapters four and five by friday',
    ]);
  });

  it('does not cut inside a time', () => {
    // The field people dictate most, and the one a naive full-stop split
    // lands in the middle of.
    expect(cut('econ problem set due friday at 5 p.m.')).toEqual([
      'econ problem set due friday at 5 p.m.',
    ]);
  });

  it('does not cut after an initial', () => {
    expect(cut('email Dr. Nolan about the psci paper')).toEqual([
      'email Dr. Nolan about the psci paper',
    ]);
  });

  it('gives back one piece rather than none for a run with no structure', () => {
    // An empty list would leave the screen with nothing on it and the words
    // gone, which is the one outcome worse than a bad split.
    expect(cut('pick up my library book')).toEqual(['pick up my library book']);
  });

  it('never comes back empty for anything with a word in it', () => {
    // The invariant that lets `split` end without a fallback: every step
    // either passes a piece through or replaces it with pieces. Over the odd
    // shapes rather than the tidy ones, because that is where a step that
    // filtered everything out would show.
    for (const odd of [
      '.',
      '...',
      'and then',
      'also also also',
      ';;;',
      '\u2022',
      'a',
      'friday',
      '5 p.m.',
      'econ',
      '\n\n econ \n\n',
      'econ ps4 friday.',
    ]) {
      const got = cut(odd);
      if (/[a-z0-9]/i.test(odd)) {
        expect(got.length, `"${odd}" came back as nothing`).toBeGreaterThan(0);
        for (const piece of got) expect(piece.trim()).not.toBe('');
      }
    }
  });

  it('gives back nothing at all for nothing at all', () => {
    expect(cut('')).toEqual([]);
    expect(cut('   \n  ')).toEqual([]);
  });
});

describe('breaks somebody typed', () => {
  it('cuts on newlines', () => {
    expect(cut('econ ps4 friday\npsci reading tuesday')).toEqual([
      'econ ps4 friday',
      'psci reading tuesday',
    ]);
  });

  it('cuts on semicolons', () => {
    expect(cut('econ ps4 friday; psci reading tuesday')).toEqual([
      'econ ps4 friday',
      'psci reading tuesday',
    ]);
  });

  it('cuts on bullets', () => {
    expect(cut('• econ ps4 friday • psci reading tuesday')).toEqual([
      'econ ps4 friday',
      'psci reading tuesday',
    ]);
  });

  it('says a written break is what cut it', () => {
    expect(seams('econ ps4 friday\npsci reading tuesday')).toEqual(['first', 'written']);
  });
});

describe('sentences', () => {
  it('cuts where a stop really ended one', () => {
    expect(cut('econ ps4 is due friday. psci reading tuesday.')).toEqual([
      'econ ps4 is due friday',
      'psci reading tuesday',
    ]);
  });

  it('names the stop as the seam', () => {
    expect(seams('econ ps4 friday. psci reading tuesday')).toEqual(['first', 'stop']);
  });
});

describe('the words people join a spoken list with', () => {
  it('cuts on "also"', () => {
    expect(cut('econ ps4 friday also psci reading tuesday')).toEqual([
      'econ ps4 friday',
      'psci reading tuesday',
    ]);
  });

  it('cuts on "and then"', () => {
    expect(cut('econ ps4 friday and then psci reading tuesday')).toEqual([
      'econ ps4 friday',
      'psci reading tuesday',
    ]);
  });

  it('cuts on "oh and", which is how people actually talk', () => {
    expect(cut('econ ps4 friday oh and pick up my library book')).toEqual([
      'econ ps4 friday',
      'pick up my library book',
    ]);
  });

  it('names the joining word as the seam', () => {
    expect(seams('econ ps4 friday also psci reading tuesday')).toEqual(['first', 'said']);
  });
});

describe('a run with no punctuation and no joining words', () => {
  it('cuts where a second course starts', () => {
    // The whole reason the structural rule exists: this is what dictation
    // hands back, and as one item it commits as one plausible wrong deadline.
    expect(cut('econ problem set friday psci reading tuesday')).toEqual([
      'econ problem set friday',
      'psci reading tuesday',
    ]);
  });

  it('names the second course as the seam', () => {
    expect(seams('econ problem set friday psci reading tuesday')).toEqual(['first', 'course']);
  });

  it('does not cut at a course the first fragment has no date for yet', () => {
    // The control, and the narrowness of the rule. Here PSCI cannot be the
    // start of a second item, because the first has not finished — it has no
    // date. Cutting would invent two items out of one joint session.
    expect(cut('the econ and psci joint session friday')).toEqual([
      'the econ and psci joint session friday',
    ]);
  });

  it('does not cut on the same course named twice', () => {
    expect(cut('econ problem set friday econ quiz')).toEqual(['econ problem set friday econ quiz']);
  });

  it('leaves a short run alone', () => {
    // Under four words there is no room for two things, and a rule firing
    // there is a rule firing on noise.
    expect(cut('econ psci friday')).toEqual(['econ psci friday']);
  });
});

describe('nothing is lost, whatever it cuts', () => {
  const RUNS = [
    'econ ps4 friday also psci reading tuesday oh and pick up my library book',
    'econ problem set friday psci reading tuesday core essay next monday',
    'econ ps4 is due friday. psci reading tuesday. return the library book',
    'econ ps4 friday\npsci reading tuesday; core essay monday',
    'read chapters four and five for econ by friday at 5 p.m.',
    'pick up my library book',
    'econ quiz thursday and then psci memo friday next core reading',
  ];

  const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];

  /** The words this splitter is allowed to swallow, and only these. */
  const SEPARATORS = new Set(['and', 'then', 'oh', 'also', 'next', 'after', 'that', 'plus']);

  it('keeps every word in order, dropping only the words that joined them', () => {
    // Stated over a corpus rather than an example, because the thing being
    // checked is a property of the splitter and not of any one sentence. The
    // pieces have to be a subsequence of the run — nothing invented, nothing
    // reordered — and whatever fell out has to be a joining word, so a bug
    // that silently ate half a title cannot pass by calling itself a seam.
    for (const run of RUNS) {
      const had = words(run);
      const got = cut(run).flatMap(words);
      let at = 0;
      const dropped: string[] = [];
      for (const w of had) {
        if (w === got[at]) at += 1;
        else dropped.push(w);
      }
      expect(at, `pieces of "${run}" are not a subsequence of it`).toBe(got.length);
      for (const w of dropped) expect(SEPARATORS, `dropped "${w}" from "${run}"`).toContain(w);
    }
  });

  it('never returns an empty or blank piece', () => {
    for (const run of RUNS) {
      for (const piece of cut(run)) expect(piece.trim()).not.toBe('');
    }
  });
});

describe('readAloud', () => {
  const rows = (text: string): Read[] => readAloud(text, COURSES, now);

  it('reads each piece into its own course, kind and date', () => {
    const [a, b] = rows('econ problem set friday psci reading tuesday');
    expect(a.caught.courseId).toBe('econ');
    expect(a.caught.kind).toBe('Problem set');
    expect(a.caught.date).not.toBe('');
    expect(b.caught.courseId).toBe('psci');
    expect(b.caught.kind).toBe('Reading');
    expect(b.caught.date).not.toBe('');
    expect(a.caught.date).not.toBe(b.caught.date);
  });

  it('does not give one item another item’s date', () => {
    // The failure the whole file exists to prevent, said as an assertion:
    // undivided, this run parses as one thing with one date and the rest of
    // the words swept into its title.
    const all = rows('econ ps4 friday psci reading tuesday');
    expect(all.length).toBe(2);
    for (const r of all) expect(r.caught.title).not.toContain('psci reading');
  });

  it('leaves a piece with nothing in it to read as a plain title', () => {
    const [only] = rows('pick up my library book');
    expect(only.caught.courseId).toBeNull();
    expect(only.caught.date).toBe('');
    expect(only.caught.title).toContain('library book');
  });
});

describe('heardLine', () => {
  const made = (n: number) => Array.from({ length: n }, () => ({}) as Read);

  it('counts what it found rather than claiming it got it right', () => {
    expect(heardLine(made(3))).toContain('3 things');
    expect(heardLine(made(3))).toContain('edited or dropped');
  });

  it('uses the singular for one', () => {
    expect(heardLine(made(1))).toContain('One thing');
  });

  it('says so when it heard nothing', () => {
    expect(heardLine([])).toBe('Nothing was heard.');
  });
});
