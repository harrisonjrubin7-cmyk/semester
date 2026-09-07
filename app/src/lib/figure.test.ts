import { describe, expect, it } from 'vitest';
import { MOST_FIGURES, describeFigure, readFigure, readFigures } from './figure';
import { DIAGRAM_KINDS } from './types';

const bars = (over: Record<string, unknown> = {}) => ({
  type: 'bars',
  title: 'Where the money went',
  caption: 'Federal outlays, 2024',
  unit: '% of outlays',
  max: 100,
  rows: [
    { l: 'Social Security', v: 21 },
    { l: 'Medicare', v: 14 },
    { l: 'Defence', v: 13 },
  ],
  ...over,
});

describe('a table of numbers', () => {
  it('comes through with its rows and its unit', () => {
    const f = readFigure(bars());
    expect(f).toEqual({
      type: 'bars',
      title: 'Where the money went',
      caption: 'Federal outlays, 2024',
      unit: '% of outlays',
      max: 100,
      rows: [
        { l: 'Social Security', v: 21 },
        { l: 'Medicare', v: 14 },
        { l: 'Defence', v: 13 },
      ],
    });
  });

  it('reads a number that arrived quoted', () => {
    // Asking for JSON gets "21" about as often as 21, and a correct row should
    // not be dropped over quoting.
    const f = readFigure(bars({ rows: [{ l: 'A', v: '21' }, { l: 'B', v: '14.5' }] }));
    expect(f).toMatchObject({ rows: [{ l: 'A', v: 21 }, { l: 'B', v: 14.5 }] });
  });

  it('refuses a number that is not one', () => {
    // "about 12" and "12%" are the two that matter: whether the axis is
    // already a percentage is exactly what must not be guessed.
    for (const v of ['about 12', '12%', '1e4', '', null, undefined, NaN, Infinity, {}]) {
      expect(readFigure(bars({ rows: [{ l: 'A', v }, { l: 'B', v: 3 }] })), String(v)).toBeNull();
    }
  });

  it('drops a row missing a half rather than putting a zero there', () => {
    // A bar of length zero is a claim the material did not make.
    const f = readFigure(
      bars({ rows: [{ l: 'A', v: 5 }, { l: '', v: 9 }, { l: 'C' }, { l: 'D', v: 2 }] }),
    );
    expect(f).toMatchObject({ rows: [{ l: 'A', v: 5 }, { l: 'D', v: 2 }] });
  });

  it('is not a table with one row', () => {
    expect(readFigure(bars({ rows: [{ l: 'Only', v: 100 }] }))).toBeNull();
    expect(readFigure(bars({ rows: [] }))).toBeNull();
    expect(readFigure(bars({ rows: 'three of them' }))).toBeNull();
  });

  it('needs a unit, because a number without one says nothing', () => {
    expect(readFigure(bars({ unit: '' }))).toBeNull();
    expect(readFigure(bars({ unit: undefined }))).toBeNull();
  });

  it('raises a max that would clip the tallest bar', () => {
    // A stated max below the tallest row draws a bar past the end of its own
    // axis — correct numbers, wrong picture.
    expect(readFigure(bars({ max: 10 }))).toMatchObject({ max: 21 });
  });

  it('keeps a max above the tallest, which is a real axis choice', () => {
    // 0-100 for percentages is right even when nothing reaches 100.
    expect(readFigure(bars({ max: 100 }))).toMatchObject({ max: 100 });
  });

  it('falls back to the tallest bar when no max was given', () => {
    expect(readFigure(bars({ max: undefined }))).toMatchObject({ max: 21 });
    expect(readFigure(bars({ max: 'lots' }))).toMatchObject({ max: 21 });
  });

  it('refuses a chart whose bars are all zero', () => {
    expect(readFigure(bars({ max: 0, rows: [{ l: 'A', v: 0 }, { l: 'B', v: 0 }] }))).toBeNull();
  });

  it('caps a table long enough to stop being a figure', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ l: `Row ${i}`, v: i + 1 }));
    expect(readFigure(bars({ rows: many, max: 40 }))).toMatchObject({ max: 40 });
    expect((readFigure(bars({ rows: many })) as { rows: unknown[] }).rows).toHaveLength(12);
  });
});

describe('a process', () => {
  const steps = (over: Record<string, unknown> = {}) => ({
    type: 'steps',
    title: 'How a bill becomes law',
    caption: 'The short version',
    steps: [
      { n: '1', t: 'Introduced', d: 'A member files it.' },
      { n: '2', t: 'Committee', d: 'Where most of them stop.' },
    ],
    ...over,
  });

  it('comes through in order', () => {
    expect(readFigure(steps())).toMatchObject({
      type: 'steps',
      steps: [{ n: '1', t: 'Introduced' }, { n: '2', t: 'Committee' }],
    });
  });

  it('numbers a step that arrived without one', () => {
    const f = readFigure(steps({ steps: [{ t: 'One', d: 'x' }, { t: 'Two', d: 'y' }] }));
    expect(f).toMatchObject({ steps: [{ n: '1' }, { n: '2' }] });
  });

  it('renumbers around a step it had to drop, rather than skipping a number', () => {
    const f = readFigure(
      steps({ steps: [{ t: 'One', d: 'x' }, { t: 'Broken' }, { t: 'Three', d: 'z' }] }),
    );
    expect(f).toMatchObject({ steps: [{ n: '1', t: 'One' }, { n: '2', t: 'Three' }] });
  });

  it('is not a process with one step', () => {
    expect(readFigure(steps({ steps: [{ n: '1', t: 'Only', d: 'x' }] }))).toBeNull();
  });
});

describe('a drawn diagram', () => {
  it('is accepted only by a name the app can actually draw', () => {
    for (const kind of DIAGRAM_KINDS) {
      expect(readFigure({ type: 'diagram', title: 'T', caption: 'C', kind }), kind).toMatchObject({
        kind,
      });
    }
  });

  it('refuses a plausible name that is not one of them', () => {
    // The failure this exists to stop: a diagram named in the reply, accepted,
    // and rendered as a blank card because nothing draws it.
    for (const kind of ['phillips-curve', 'supply_demand', 'Supply-Demand', 'laffer', '', null]) {
      expect(readFigure({ type: 'diagram', title: 'T', caption: 'C', kind }), String(kind)).toBeNull();
    }
  });
});

describe('what is never accepted', () => {
  it('an image, because its file is on this device', () => {
    // A model naming a fileId is guessing or pointing at somebody else's file.
    expect(readFigure({ type: 'image', title: 'T', caption: 'C', fileId: 'abc' })).toBeNull();
  });

  it('a type the app has no renderer for', () => {
    expect(readFigure({ type: 'pie', title: 'T', caption: 'C', slices: [] })).toBeNull();
    expect(readFigure({ type: 'html', title: 'T', caption: 'C' })).toBeNull();
  });

  it('anything untitled', () => {
    expect(readFigure(bars({ title: '' }))).toBeNull();
    expect(readFigure(bars({ title: 42 }))).toBeNull();
  });

  it('a reply that is not an object at all', () => {
    for (const v of [null, undefined, 'bars', 7, []]) expect(readFigure(v)).toBeNull();
  });
});

describe('a whole reply', () => {
  it('keeps what survives and drops what does not, without failing the rest', () => {
    const got = readFigures([bars(), { type: 'pie' }, bars({ title: 'Second' })]);
    expect(got.map((f) => f.title)).toEqual(['Where the money went', 'Second']);
  });

  it('stops at the cap', () => {
    const got = readFigures(Array.from({ length: 9 }, (_, i) => bars({ title: `T${i}` })));
    expect(got).toHaveLength(MOST_FIGURES);
  });

  it('is empty for anything that is not a list', () => {
    for (const v of [null, undefined, {}, 'none']) expect(readFigures(v)).toEqual([]);
  });
});

describe('how a figure reads before it is saved', () => {
  it('says what it is, so it can be checked against the reading', () => {
    expect(describeFigure(readFigure(bars())!)).toBe(
      'Where the money went — a table, 3 rows in % of outlays',
    );
    expect(
      describeFigure({ type: 'diagram', title: 'The market', caption: '', kind: 'supply-demand' }),
    ).toBe('The market — the supply demand diagram');
  });
});
