import { describe, expect, it } from 'vitest';
import {
  MOST_FIGURES,
  describeFigure,
  figureShapes,
  readDrawn,
  readFigure,
  readFigures,
} from './figure';
import { capsFor } from './controls';
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

describe('the ceiling a student chose', () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      type: 'steps',
      title: `Figure ${i}`,
      caption: 'What it shows.',
      steps: [
        { n: '1', t: 'First', d: 'It begins.' },
        { n: '2', t: 'Then', d: 'It continues.' },
      ],
    }));

  /*
   * Figures were the one kind left on a fixed ceiling while everything around
   * them scaled: `brief` kept three and `full` could never keep more than
   * three, however much the material had.
   */
  it('keeps the raised ceiling that thorough asked for', () => {
    const caps = capsFor({ depth: 'full', level: 'course', cards: 0 });
    expect(caps.figures).toBeGreaterThan(MOST_FIGURES);
    expect(readFigures(many(9), caps)).toHaveLength(caps.figures);
    expect(readFigures(many(9))).toHaveLength(MOST_FIGURES);
  });

  it('enforces the lowered ceiling that brief asked for', () => {
    const caps = capsFor({ depth: 'brief', level: 'course', cards: 0 });
    expect(readFigures(many(9), caps)).toHaveLength(caps.figures);
  });

  // The description and the validator that enforces it have to agree — they
  // drifted once already in this codebase.
  it('asks for the same number it will keep', () => {
    const caps = capsFor({ depth: 'full', level: 'course', cards: 0 });
    expect(figureShapes(caps)).toContain(`0 to ${caps.figures} figures`);
    expect(figureShapes()).toContain(`0 to ${MOST_FIGURES} figures`);
  });
});


describe('a drawing kept as a figure', () => {
  const svg = '<svg viewBox="0 0 600 420"><text x="10" y="20">Titration curve</text></svg>';

  const drawn = (over: Record<string, unknown> = {}) => ({
    title: 'A titration curve for a weak acid',
    caption: 'Drawn for CHEM 1601 — a graph with axes.',
    language: 'svg',
    code: svg,
    ...over,
  });

  it('keeps the code, the language and what it was called', () => {
    expect(readDrawn(drawn())).toEqual({
      type: 'drawn',
      title: 'A titration curve for a weak acid',
      caption: 'Drawn for CHEM 1601 — a graph with axes.',
      language: 'svg',
      code: svg,
    });
  });

  it('takes Mermaid, checked as Mermaid', () => {
    const f = readDrawn(drawn({ language: 'mermaid', code: 'flowchart TD\n  A[Bill] --> B[Law]' }));
    expect(f).toMatchObject({ type: 'drawn', language: 'mermaid' });
  });

  it('stores the Mermaid with its init directive already gone', () => {
    /*
     * `%%{init}%%` can set configuration including a font loaded from
     * elsewhere. `cleanMermaid` strips it on the way to the renderer, and
     * keeping the original would mean storing the thing that was stripped and
     * stripping it again on every render for as long as the course exists.
     */
    const f = readDrawn(
      drawn({ language: 'mermaid', code: '%%{init: {"theme":"forest"}}%%\nflowchart TD\n  A --> B' }),
    );
    expect(f).toMatchObject({ code: 'flowchart TD\n  A --> B' });
  });

  it('refuses an apology, in either language', () => {
    // The commonest non-drawing there is: the model explains instead of
    // drawing. Stored, it is a Figures card showing a paragraph of prose.
    const said = 'I am sorry, I cannot draw that without more detail.';
    expect(readDrawn(drawn({ code: said }))).toBeNull();
    expect(readDrawn(drawn({ language: 'mermaid', code: said }))).toBeNull();
  });

  it('refuses a language it does not have', () => {
    expect(readDrawn(drawn({ language: 'latex' }))).toBeNull();
    expect(readDrawn(drawn({ language: '' }))).toBeNull();
  });

  it('refuses one with no title, since a figure card leads with it', () => {
    expect(readDrawn(drawn({ title: '   ' }))).toBeNull();
  });

  it('refuses code past the ceiling rather than storing it', () => {
    expect(readDrawn(drawn({ code: `<svg>${'x'.repeat(20_001)}</svg>` }))).toBeNull();
  });

  it('takes a caption of none, because a drawing names itself', () => {
    expect(readDrawn(drawn({ caption: undefined }))).toMatchObject({ caption: '' });
  });

  it('says what it is in a line', () => {
    expect(describeFigure(readDrawn(drawn())!)).toBe(
      'A titration curve for a weak acid — a drawing, in SVG',
    );
    expect(
      describeFigure(readDrawn(drawn({ language: 'mermaid', code: 'flowchart TD\n A --> B' }))!),
    ).toBe('A titration curve for a weak acid — a drawing, in Mermaid');
  });
});

describe('what a model reading material may put in a guide', () => {
  /*
   * The closure is the safety argument, so it is asserted rather than
   * described. Everything `readFigure` accepts is a shape whose every field it
   * checked; `drawn` holds generated markup, which has no such floor. If this
   * ever passes, any reading added to any course can put a drawing of its own
   * choosing into the guide unasked — which is a different product.
   */
  it('is not a drawing, however well-formed', () => {
    expect(
      readFigure({
        type: 'drawn',
        title: 'A supply curve',
        caption: 'From the reading.',
        language: 'svg',
        code: '<svg viewBox="0 0 600 420"><path d="M0 0" /></svg>',
      }),
    ).toBeNull();
  });

  it('is not a drawing even in a list of otherwise good figures', () => {
    const out = readFigures([
      bars(),
      { type: 'drawn', title: 'A curve', caption: '', language: 'svg', code: '<svg></svg>' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('bars');
  });

  it('does not offer the shape to the model either', () => {
    // The prompt and the validator are in one file precisely so they cannot
    // drift. Asking for a shape nothing accepts wastes a reply and teaches the
    // model a door that is not there.
    //
    // Matched on the shape rather than on the word: the prompt says "these
    // hand-drawn diagrams" about `kind`, which is the closed arm and the
    // opposite of what this is checking for.
    expect(figureShapes()).not.toContain('"type":"drawn"');
    expect(figureShapes()).toContain('exactly three shapes');
  });
});
