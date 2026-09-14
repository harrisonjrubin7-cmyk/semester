/**
 * How a document is set up as a page.
 *
 * The app could write a .docx and could not write the .docx anybody was
 * actually asked for. A Vanderbilt humanities syllabus says the same three
 * things every time — *double-spaced, 12-point Times New Roman, one-inch
 * margins* — and the file this app produced was 11-point Calibri at 1.15, so
 * the last step of every submission was opening Word and selecting all.
 *
 * That is the whole of why this exists. Not a design surface: four presets, a
 * handful of overrides, and every one of them a thing a marker has written
 * down somewhere.
 *
 * ## Presets, because nobody reads the style guide twice
 *
 * MLA, APA and Chicago are the three a first-year is handed, and their page
 * setup — as distinct from their citation style, which this does not touch —
 * is nearly the same: 12-point, double-spaced, one-inch margins. What differs
 * is the top right corner, and that is the part people lose marks on.
 *
 * ## What is deliberately not here
 *
 * Citation formatting. A style is a bibliography and a set of in-text rules,
 * and half a citation engine is worse than none: it produces something that
 * looks right and is wrong in the details a marker checks. This file is about
 * the shape of the page, and the screen says so.
 */

/** The three a course actually names, plus the app's own. */
export type PageStyleId = 'own' | 'mla' | 'apa' | 'chicago';

export type Spacing = 'single' | 'onehalf' | 'double';
export type Paper = 'letter' | 'a4';

export interface Layout {
  /** Which preset this came from, for showing it chosen. `own` once edited. */
  style: PageStyleId;
  /** A family name as Word spells it — the font stack is worked out from it. */
  font: string;
  /** Points. Word stores half-points; the conversion lives in `docx.ts`. */
  size: number;
  spacing: Spacing;
  /** Inches, all four sides. */
  margin: number;
  paper: Paper;
  /**
   * What goes in the top right of every page, before the page number.
   *
   * MLA's running head is a surname; Chicago and APA want the number alone.
   * Empty with `numbers` on gives the number by itself, which is the
   * commonest ask and was impossible before — the .docx had no header at all,
   * so a ten-page paper arrived with no page numbers on it.
   */
  runningHead: string;
  numbers: boolean;
  /**
   * The first page as a title page of its own.
   *
   * Title, subtitle and nothing else, then a page break. What APA asks for
   * and what a long report wants regardless; off for an MLA paper, whose
   * first page carries the heading block and the essay together.
   */
  titlePage: boolean;
}

export interface PageStyle {
  id: PageStyleId;
  label: string;
  /** The line under the name: who asks for this and what it changes. */
  says: string;
  layout: Omit<Layout, 'style'>;
}

const TIMES = 'Times New Roman';

export const PAGE_STYLES: PageStyle[] = [
  {
    id: 'own',
    label: 'This app',
    says: 'Calibri at 11, a page and a half of spacing — for a handout or a memo.',
    layout: {
      font: 'Calibri',
      size: 11,
      spacing: 'single',
      margin: 1,
      paper: 'letter',
      runningHead: '',
      numbers: false,
      titlePage: false,
    },
  },
  {
    id: 'mla',
    label: 'MLA',
    says: 'Double-spaced Times at 12, and your surname beside the page number.',
    layout: {
      font: TIMES,
      size: 12,
      spacing: 'double',
      margin: 1,
      paper: 'letter',
      runningHead: 'Surname',
      numbers: true,
      titlePage: false,
    },
  },
  {
    id: 'apa',
    label: 'APA',
    says: 'The same page, a title page of its own, and the number alone in the corner.',
    layout: {
      font: TIMES,
      size: 12,
      spacing: 'double',
      margin: 1,
      paper: 'letter',
      runningHead: '',
      numbers: true,
      titlePage: true,
    },
  },
  {
    id: 'chicago',
    label: 'Chicago',
    says: 'Double-spaced Times at 12, a title page, and page numbers from the top right.',
    layout: {
      font: TIMES,
      size: 12,
      spacing: 'double',
      margin: 1,
      paper: 'letter',
      runningHead: '',
      numbers: true,
      titlePage: true,
    },
  },
];

/** The app's own, which is what a document with no layout on it is. */
export const DEFAULT_LAYOUT: Layout = { style: 'own', ...PAGE_STYLES[0].layout };

/** The layout a document is in, whatever it says — an unknown name reads as the default. */
export function layoutOf(doc: { layout?: Layout }): Layout {
  return doc.layout ? { ...DEFAULT_LAYOUT, ...doc.layout } : DEFAULT_LAYOUT;
}

export function styleNamed(id: PageStyleId): PageStyle {
  return PAGE_STYLES.find((s) => s.id === id) ?? PAGE_STYLES[0];
}

/** A preset as a whole layout, ready to be written to a document. */
export function fromStyle(id: PageStyleId): Layout {
  return { style: id, ...styleNamed(id).layout };
}

/**
 * The same layout with one thing changed, and the preset let go of.
 *
 * Changing the font of an MLA paper does not make it something else, but it
 * does make it no longer *the preset* — and a picker still showing MLA
 * highlighted while the page is 14-point Arial is the picker lying. `own` is
 * what "you have your own settings" is called.
 */
export function adjusted(layout: Layout, change: Partial<Omit<Layout, 'style'>>): Layout {
  const next = { ...layout, ...change };
  const match = PAGE_STYLES.find((s) => same(s.layout, next));
  return { ...next, style: match ? match.id : 'own' };
}

function same(a: Omit<Layout, 'style'>, b: Omit<Layout, 'style'>): boolean {
  return (
    a.font === b.font &&
    a.size === b.size &&
    a.spacing === b.spacing &&
    a.margin === b.margin &&
    a.paper === b.paper &&
    a.runningHead === b.runningHead &&
    a.numbers === b.numbers &&
    a.titlePage === b.titlePage
  );
}

export const SPACINGS: { id: Spacing; label: string; of: number }[] = [
  { id: 'single', label: 'Single', of: 1.15 },
  { id: 'onehalf', label: 'One and a half', of: 1.5 },
  { id: 'double', label: 'Double', of: 2 },
];

/**
 * A line height as a multiple.
 *
 * "Single" is 1.15 rather than 1, which is Word's own single and has been
 * since 2007 — a document set to a true 1.0 looks cramped beside every other
 * document the marker opens that day.
 */
export function lineHeight(spacing: Spacing): number {
  return SPACINGS.find((s) => s.id === spacing)?.of ?? 1.15;
}

/** The fonts offered, each with a stack the browser can actually draw. */
export const FONTS: { name: string; stack: string; says: string }[] = [
  { name: 'Times New Roman', stack: "'Times New Roman', Times, serif", says: 'What a humanities syllabus asks for' },
  { name: 'Georgia', stack: "Georgia, 'Times New Roman', serif", says: 'A serif that reads better on a screen' },
  { name: 'Calibri', stack: "Calibri, Carlito, 'Segoe UI', sans-serif", says: "Word's own, and this app's" },
  { name: 'Arial', stack: "Arial, Helvetica, sans-serif", says: 'The sans-serif a science course asks for' },
  { name: 'Garamond', stack: "Garamond, 'EB Garamond', Georgia, serif", says: 'Smaller on the page at the same size' },
];

export function fontStack(name: string): string {
  return FONTS.find((f) => f.name === name)?.stack ?? FONTS[0].stack;
}

/** The page, in inches. Letter and A4 are the only two anybody prints on. */
export function pageSize(paper: Paper): { width: number; height: number } {
  return paper === 'a4' ? { width: 8.27, height: 11.69 } : { width: 8.5, height: 11 };
}

/**
 * Roughly how many pages this will come to.
 *
 * Words per page, from the type size and the spacing, and said as "about"
 * everywhere it is shown. It is not a promise about Word's line breaking —
 * nothing in a browser can be — but "about four pages" against a five-page
 * minimum is the question being asked, and the honest answer to it is an
 * estimate rather than silence.
 *
 * 500 words to a page is the single-spaced measure everybody uses; doubling
 * the spacing halves it, which is where the familiar 250 comes from.
 */
export function pages(words: number, layout: Layout): number {
  const density = (500 * 11) / layout.size / lineHeight(layout.spacing);
  return Math.max(1, Math.round(words / density));
}
