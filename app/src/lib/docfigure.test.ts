import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { blankBlock, blankDoc, figureSays, figureTable, hasContent, toMarkdown, DOC_FIGURES, type Block, type DocFigure, type Doc } from './document';
import { compare, inDocx, inPdf, wanted } from './exportqa';
import { glance } from './doctools';

const BARS: DocFigure = {
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
};

const STEPS: DocFigure = {
  type: 'steps',
  title: 'How a bill becomes law',
  caption: 'The short version',
  steps: [
    { n: '1', t: 'Introduced', d: 'A member drops it in the hopper.' },
    { n: '2', t: 'Committee', d: 'Where most of them stop.' },
  ],
};

const doc = (blocks: Block[]): Doc => ({ ...blankDoc('D'), id: 'd', blocks });

describe('a figure a document can hold', () => {
  it('takes three of the five arms, and the type is what enforces it', () => {
    // Narrowed at the type rather than checked at each call site, so no
    // exporter needs a branch for a drawn diagram and none can forget one.
    expect(DOC_FIGURES).toEqual(['bars', 'steps', 'image']);
    const source = readFileSync('src/lib/document.ts', 'utf8');
    expect(source).toContain("Extract<Figure, { type: 'bars' | 'steps' | 'image' }>");
  });

  it('reduces a bar chart to the two columns the bars are a reading of', () => {
    expect(figureTable(BARS)?.rows).toEqual([
      ['', '% of outlays'],
      ['Social Security', '21 % of outlays'],
      ['Medicare', '14 % of outlays'],
      ['Defence', '13 % of outlays'],
    ]);
  });

  it('reduces a sequence to its steps, in order', () => {
    expect(figureTable(STEPS)?.rows).toEqual([
      ['Step', 'What happens'],
      ['1. Introduced', 'A member drops it in the hopper.'],
      ['2. Committee', 'Where most of them stop.'],
    ]);
  });

  it('gives a picture no table, because it is not one', () => {
    expect(figureTable({ type: 'image', title: 'T', caption: 'C', fileId: 'x' })).toBeNull();
  });

  it('is content once it has anything in it, titled or not', () => {
    expect(hasContent(doc([{ kind: 'figure', figure: BARS }]))).toBe(true);
    expect(hasContent(doc([blankBlock('figure')]))).toBe(false);
  });
});

describe('the same figure in every rendering', () => {
  /*
   * The point of the whole item: `lib/exportqa.ts` found four places where the
   * two exports of one document disagreed, and a new block kind is the easiest
   * possible way to make a fifth. Both exporters and the on-screen page go
   * through one reduction, and this is what asserts they did.
   */
  it('says the same thing in the .docx and the .pdf', () => {
    for (const figure of [BARS, STEPS]) {
      expect(compare(doc([{ kind: 'figure', figure }])), figure.type).toEqual([]);
    }
  });

  it('carries every label and value into both files', () => {
    const d = doc([{ kind: 'figure', figure: BARS }]);
    for (const carried of [inDocx(d).text, inPdf(d).text]) {
      expect(carried).toContain('Where the money went');
      expect(carried).toContain('Social Security');
      expect(carried).toContain('21 % of outlays');
      expect(carried).toContain('Federal outlays, 2024');
    }
  });

  it('obliges what the block says rather than what an exporter does', () => {
    const want = wanted({ kind: 'figure', figure: STEPS });
    expect(want.things).toEqual(['table']);
    expect(want.text).toContain('How a bill becomes law');
    expect(want.text).toContain('A member drops it in the hopper.');
  });

  it('writes a figure into markdown as the table it is, not as nothing', () => {
    const md = toMarkdown(doc([{ kind: 'figure', figure: BARS }]));
    expect(md).toContain('*Where the money went*');
    expect(md).toContain('| Social Security | 21 % of outlays |');
    expect(md).toContain('*Federal outlays, 2024*');
  });

  it('names itself in a thumbnail rather than leaving a blank line', () => {
    expect(glance(doc([{ kind: 'figure', figure: BARS }]))).toEqual([
      'Figure — Where the money went',
    ]);
  });

  it('is searchable by every label in it', () => {
    expect(figureSays(BARS)).toContain('Medicare');
    expect(figureSays(STEPS)).toContain('Where most of them stop.');
  });
});

describe('every renderer has a case for every kind', () => {
  /*
   * Three of the places a block is drawn return nothing, so a kind with no
   * case falls out of the switch and draws *nothing at all* — which is how
   * `screens/write/Paper.tsx` came to render a picture as a blank space while
   * both exports carried it. Asserted structurally: a `never` at the foot of
   * the switch is what makes the typecheck the guard.
   */
  for (const file of ['src/lib/pdfout.ts', 'src/screens/write/Paper.tsx']) {
    it(`${file} cannot quietly skip one`, () => {
      expect(readFileSync(file, 'utf8')).toContain(': never = ');
    });
  }

  it('and the ones that return a value are guarded by their return type', () => {
    for (const file of ['src/lib/docx.ts', 'src/lib/find.ts']) {
      const source = readFileSync(file, 'utf8');
      expect(source).toContain("case 'figure'");
    }
  });
});
