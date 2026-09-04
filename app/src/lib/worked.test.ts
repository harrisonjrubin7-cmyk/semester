import { describe, expect, it } from 'vitest';
import { basis, document, findings, leadDays, nothingLine, type TermInput } from './worked';
import type { Sitting } from './sitting';
import type { Spent } from './pace';

const DAY = 86_400_000;
const T0 = new Date(2026, 8, 1).getTime();

const paper = (pct: number, at: number): Sitting =>
  ({
    id: `s${at}`,
    courseId: 'econ',
    title: 'Paper',
    at,
    minutes: 30,
    got: pct,
    outOf: 100,
    pct,
    code: '',
    missed: [],
  }) as Sitting;

const tick = (leadDaysEarly: number, n: number) => ({
  id: `t${n}`,
  courseId: 'econ',
  dueAt: T0 + n * DAY,
  tickedAt: T0 + n * DAY - leadDaysEarly * DAY,
});

const spent = (kind: string, minutes: number, n: number): Spent => ({
  id: `p${n}`,
  courseId: 'econ',
  kind,
  minutes,
  at: T0,
});

const codeOf = (id: string) => id.toUpperCase();

const empty: TermInput = { sittings: [], ticks: [], spent: [], drilled: {}, codeOf };

describe('when there is nothing worth saying', () => {
  it('says nothing rather than manufacturing something', () => {
    expect(findings(empty)).toEqual([]);
  });

  it('names the specific thing that was too thin', () => {
    // "You sat two papers and three is the floor" tells somebody how to get a
    // report next term. "Not enough data" does not.
    const said = nothingLine({ ...empty, sittings: [paper(60, T0), paper(65, T0 + DAY)] });
    expect(said).toContain('2 of 3 practice papers');
    expect(said).toContain('0 of 8 ticked deadlines');
  });

  it('does not read a quiet term as a bad one', () => {
    expect(nothingLine(empty)).toContain('not a judgement about the term');
  });

  it('has nothing to explain once the floors are cleared', () => {
    const full: TermInput = {
      ...empty,
      ticks: Array.from({ length: 8 }, (_, n) => tick(1, n)),
      sittings: [paper(60, T0), paper(65, T0 + DAY), paper(70, T0 + 2 * DAY)],
      drilled: { econ: { right: 25, wrong: 10 } },
    };
    expect(nothingLine(full)).toBe('');
  });
});

describe('how far ahead you finish', () => {
  const eight = (lead: number) => Array.from({ length: 8 }, (_, n) => tick(lead, n));

  it('says nothing on seven ticks and something on eight', () => {
    expect(findings({ ...empty, ticks: eight(2).slice(0, 7) })).toEqual([]);
    expect(findings({ ...empty, ticks: eight(2) })).toHaveLength(1);
  });

  it('reports the median, so one early finish does not flatter the term', () => {
    const ticks = [...Array.from({ length: 7 }, (_, n) => tick(0, n)), tick(21, 8)];
    const said = findings({ ...empty, ticks })[0].said;
    expect(said).toContain('on the day it was due');
  });

  it('counts the days honestly, negative when late', () => {
    expect(leadDays([tick(3, 0), tick(-2, 1)])).toEqual([3, -2]);
  });

  it('says how much was ahead of time as well as the middle', () => {
    expect(findings({ ...empty, ticks: eight(2) })[0].said).toContain('100% of everything');
  });

  it('carries how many it rests on', () => {
    expect(findings({ ...empty, ticks: eight(2) })[0].from).toBe(8);
  });
});

describe('whether the practice papers moved', () => {
  it('needs three before it says anything', () => {
    const two = { ...empty, sittings: [paper(50, T0), paper(80, T0 + DAY)] };
    expect(findings(two)).toEqual([]);
  });

  it('reads a rise', () => {
    const rising = {
      ...empty,
      sittings: [paper(50, T0), paper(60, T0 + DAY), paper(72, T0 + 2 * DAY), paper(74, T0 + 3 * DAY)],
    };
    expect(findings(rising)[0].said).toMatch(/went up \d+ points across the term/);
  });

  it('reads a fall as a fall', () => {
    const falling = {
      ...empty,
      sittings: [paper(80, T0), paper(78, T0 + DAY), paper(60, T0 + 2 * DAY), paper(58, T0 + 3 * DAY)],
    };
    expect(findings(falling)[0].said).toMatch(/went down/);
  });

  it('says level rather than inventing a direction', () => {
    const flat = {
      ...empty,
      sittings: [paper(70, T0), paper(71, T0 + DAY), paper(69, T0 + 2 * DAY), paper(70, T0 + 3 * DAY)],
    };
    expect(findings(flat)[0].said).toMatch(/stayed level/);
  });

  it('does not care what order they were passed in', () => {
    const shuffled = {
      ...empty,
      sittings: [paper(74, T0 + 3 * DAY), paper(50, T0), paper(72, T0 + 2 * DAY), paper(60, T0 + DAY)],
    };
    expect(findings(shuffled)[0].said).toMatch(/went up/);
  });
});

describe('which course went better', () => {
  it('needs two decks with enough answered in each', () => {
    const thin = { ...empty, drilled: { econ: { right: 30, wrong: 5 }, psci: { right: 2, wrong: 2 } } };
    expect(findings(thin)).toEqual([]);
  });

  it('says nothing when the two are close', () => {
    const close = {
      ...empty,
      drilled: { econ: { right: 30, wrong: 10 }, psci: { right: 29, wrong: 11 } },
    };
    expect(findings(close)).toEqual([]);
  });

  it('names both ends when they genuinely differ', () => {
    const apart = {
      ...empty,
      drilled: { econ: { right: 36, wrong: 4 }, psci: { right: 20, wrong: 20 } },
    };
    expect(findings(apart)[0].said).toBe("You got 90% of ECON's cards right and 50% of PSCI's.");
  });
});

describe('what ate the term', () => {
  it('needs six timed things', () => {
    const five = { ...empty, spent: Array.from({ length: 5 }, (_, n) => spent('essay', 300, n)) };
    expect(findings(five)).toEqual([]);
  });

  it('names a kind that took more than a third of it', () => {
    const mixed = {
      ...empty,
      spent: [
        ...Array.from({ length: 4 }, (_, n) => spent('essay', 300, n)),
        ...Array.from({ length: 4 }, (_, n) => spent('problem set', 60, n + 10)),
      ],
    };
    expect(findings(mixed)[0].said).toMatch(/83% of the time you timed went on essay — 20 hours/);
  });

  it('says nothing when the time was spread evenly', () => {
    const even = {
      ...empty,
      spent: [
        ...Array.from({ length: 3 }, (_, n) => spent('essay', 60, n)),
        ...Array.from({ length: 3 }, (_, n) => spent('reading', 60, n + 10)),
        ...Array.from({ length: 3 }, (_, n) => spent('problem set', 60, n + 20)),
      ],
    };
    expect(findings(even)).toEqual([]);
  });
});

describe('the report as a whole', () => {
  const full: TermInput = {
    ...empty,
    ticks: Array.from({ length: 10 }, (_, n) => tick(2, n)),
    sittings: [paper(50, T0), paper(60, T0 + DAY), paper(75, T0 + 2 * DAY)],
    drilled: { econ: { right: 36, wrong: 4 }, psci: { right: 20, wrong: 20 } },
    spent: Array.from({ length: 8 }, (_, n) => spent('essay', 300, n)),
  };

  it('says what it rests on', () => {
    expect(basis(full)).toBe('10 deadlines ticked · 80 cards answered · 3 papers sat · 8 things timed');
  });

  it('says so plainly when it rests on nothing', () => {
    expect(basis(empty)).toBe('Nothing recorded');
  });

  it('puts when-you-work first, being the thing you can act on', () => {
    expect(findings(full)[0].said).toMatch(/finished the typical thing/);
  });

  it('writes a document with every finding and its weight', () => {
    const doc = document('Fall 2026', full);
    expect(doc).toContain('# Fall 2026');
    expect(doc).toContain('*(from 10)*');
    expect(doc).toContain('left out rather than softened');
  });

  it('writes the honest empty document', () => {
    const doc = document('Fall 2026', empty);
    expect(doc).toContain('Nothing recorded');
    expect(doc).toContain('Not enough happened in the app');
  });
});
