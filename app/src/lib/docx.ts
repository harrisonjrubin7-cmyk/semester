/**
 * A real Word file, written in the browser.
 *
 * The third of the three OOXML writers, after `pptx.ts` and `xlsx.ts`, and the
 * one the app most obviously lacked: it could already *read* a .docx syllabus
 * — `extract.ts` has been unzipping them since the beginning — and could not
 * write one. So a document built in this app left it as Markdown, which is not
 * what a professor's submission portal takes.
 *
 * ## What it writes
 *
 * The smallest package Word, Pages and Google Docs all open: content types,
 * the package relationships, the document, a stylesheet, a numbering
 * definition for lists, and the two property parts that stop Word calling the
 * file "Document1" in its own recent list.
 *
 * Styles are named and defined rather than applied as direct formatting. That
 * is the difference between a document somebody can restyle to their
 * department's template and one where every heading has to be selected by
 * hand — and a table of contents, which Word builds from heading styles, does
 * not exist at all without them.
 *
 * ## Equations
 *
 * `lib/maths.ts` renders the OMML; this puts it in a paragraph. What lands in
 * Word is a real equation object — click it and the equation editor opens on
 * it — rather than a picture of one, which is what every "export to Word"
 * that goes through HTML produces.
 *
 * ## The ways this file corrupts silently
 *
 * Unescaped text, as everywhere: `&` in a title is a parse error reported as
 * "unreadable content" with no location.
 *
 * A relationship id that names nothing, which opens as a document with no
 * styles rather than as an error.
 *
 * And `xml:space="preserve"` left off a run: Word strips leading and trailing
 * spaces from a `<w:t>` without it, so `**bold** text` loses the space before
 * "text" — which reads as a typo in the writing rather than as a bug here.
 */

import { outline } from './doctools';
import { runs, type Block, type Doc } from './document';
import { layoutOf, lineHeight, pageSize, type Layout } from './doclayout';
import { omml, parse } from './maths';
import { HEAD, REL, xml } from './ooxml';



const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

/**
 * The page, in twentieths of a point — Word's own unit, 1440 to the inch.
 *
 * Was a constant: US Letter with one-inch margins, which is right for about
 * half of what gets written and wrong for the other half. A course that asks
 * for A4, or for the inch-and-a-quarter margins an annotated bibliography
 * wants, had no way to say so and the answer was to fix it in Word.
 */
const TWIPS = 1440;

function pageXml(layout: Layout): string {
  const { width, height } = pageSize(layout.paper);
  const margin = Math.round(layout.margin * TWIPS);
  return (
    `<w:pgSz w:w="${Math.round(width * TWIPS)}" w:h="${Math.round(height * TWIPS)}"/>` +
    `<w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}"` +
    // The header sits half an inch down, which is where every style guide
    // that mentions it puts it and where Word's own default has it.
    ` w:header="${Math.round(TWIPS / 2)}" w:footer="${Math.round(TWIPS / 2)}"/>`
  );
}

/**
 * The top right corner of every page: a name, then the number.
 *
 * Its own part, because Word holds a header in one — and its own relationship
 * file, because the `PAGE` field inside it is not a relationship but the part
 * still needs the file to exist. The field is `<w:instrText>PAGE</w:instrText>`
 * between a begin and an end, which is the whole of how a page number works
 * in OOXML and reads as one line once written down.
 */
function headerXml(layout: Layout): string {
  const head = layout.runningHead.trim();
  const words = head ? `<w:r><w:t xml:space="preserve">${xml(head)} </w:t></w:r>` : '';
  const number = layout.numbers
    ? '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
      '<w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>' +
      '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
      '<w:r><w:t>1</w:t></w:r>' +
      '<w:r><w:fldChar w:fldCharType="end"/></w:r>'
    : '';
  return (
    `${HEAD}<w:hdr xmlns:w="${W}" xmlns:r="${REL}">` +
    `<w:p><w:pPr><w:jc w:val="right"/></w:pPr>${words}${number}</w:p></w:hdr>`
  );
}

/**
 * One run of text.
 *
 * A line break inside a paragraph is `<w:br/>` rather than a new paragraph:
 * an address block or a verse quotation is one paragraph with breaks in it,
 * and splitting it into paragraphs would space every line as if it were one.
 *
 * Five marks now rather than two. Strike-through and monospace are one
 * property each; a hyperlink is not a property at all — see `hyperlink`.
 */
/**
 * The external links one document points at, in the order they were met.
 *
 * A hyperlink in this format is not a URL in the paragraph — it is a
 * *relationship id*, and the URL lives in `document.xml.rels`. So writing the
 * body and writing the relationships are the same pass, and this is what
 * carries one to the other.
 *
 * Kept by target rather than per occurrence: a document citing the same page
 * four times is one relationship, not four, which is what Word itself writes.
 */
class Links {
  private readonly at = new Map<string, string>();

  /**
   * How many relationships this part already has before any link.
   *
   * Was a constant, and stopped being one when a page header arrived: styles
   * and numbering are always there, and `header1.xml` is a third when the
   * layout asks for page numbers. Passed in rather than counted here because
   * only `parts` knows, and getting it wrong hands a link the header's own
   * id — which Word opens as an unreadable document rather than as a broken
   * link.
   */
  private readonly fixed: number;

  constructor(fixed = FIXED_RELS) {
    this.fixed = fixed;
  }

  /** The relationship id for a target, making one if this is the first time. */
  id(target: string): string {
    const had = this.at.get(target);
    if (had) return had;
    const made = `rId${this.at.size + this.fixed + 1}`;
    this.at.set(target, made);
    return made;
  }

  /** Every one, as the relationship elements that go beside the fixed ones. */
  relationships(): string {
    return [...this.at].
      map(
        ([target, id]) =>
          `<Relationship Id="${id}" Type="${REL}/hyperlink" ` +
          `Target="${xml(target)}" TargetMode="External"/>`,
      )
      .join('');
  }
}

/** How many relationships `word/document.xml.rels` has before any link, at least. */
const FIXED_RELS = 2;

/**
 * The blue underline a reader expects on a link.
 *
 * Written into the run rather than added as a `Hyperlink` character style,
 * because a style is a second part to keep in step for one colour and one
 * underline — and a document whose links are styled by a style that a later
 * edit removes is a document whose links stop looking like links.
 */
const LINK_LOOK = '<w:color w:val="0563C1"/><w:u w:val="single"/>';

function run(
  piece: { text: string; bold: boolean; italic: boolean; strike: boolean; code: boolean },
  link = '',
): string {
  const props =
    `${piece.bold ? '<w:b/>' : ''}${piece.italic ? '<w:i/>' : ''}` +
    `${piece.strike ? '<w:strike/>' : ''}` +
    // A named character style rather than a font on the run, so somebody who
    // has to hand in Courier can restyle every piece of code at once. The
    // link's blue is direct formatting for the opposite reason — see
    // `LINK_LOOK`, which explains why one is a style and one is not.
    `${piece.code ? '<w:rStyle w:val="CodeChar"/>' : ''}${link ? LINK_LOOK : ''}`;
  return piece.text
    .split('\n')
    .map((line, i) => {
      const br = i > 0 ? '<w:br/>' : '';
      return (
        `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}${br}` +
        `<w:t xml:space="preserve">${xml(line)}</w:t></w:r>`
      );
    })
    .join('');
}

/**
 * A paragraph of marked-up text in a named style.
 *
 * `links` is optional so the two callers that cannot contain one — a table
 * cell measured before the collector exists, a caption built in a test —
 * still read as they did. Where it is absent a link is written as its words
 * in the link's colour, with nothing behind them: visibly a link that goes
 * nowhere rather than an invalid relationship, which Word refuses to open.
 */
function para(text: string, style?: string, extra = '', links?: Links): string {
  const props = style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>` : '';
  const body = runs(text)
    .map((r) => {
      const piece = run(r, r.link);
      if (!r.link || !links) return piece;
      return `<w:hyperlink r:id="${links.id(r.link)}">${piece}</w:hyperlink>`;
    })
    .join('');
  return `<w:p>${props}${body}</w:p>`;
}

/** A list item, at the numbering definition the list's kind points at. */
function item(text: string, numbered: boolean, links?: Links): string {
  const numbering = `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numbered ? 2 : 1}"/></w:numPr>`;
  return para(text, 'ListParagraph', numbering, links);
}

/**
 * A ticked or unticked line, as a box and then the words.
 *
 * ☒ and ☐ in front of the text rather than a Word content control. A content
 * control is the "right" answer and opens as a grey placeholder in Pages and
 * as nothing at all in Google Docs, which between them are most of the
 * machines a group project is read on. A character everybody can render, in
 * a document everybody can open, beats a live checkbox in one program.
 */
function ticked(line: { text: string; done: boolean }, links?: Links): string {
  return para(`${line.done ? '☒' : '☐'} ${line.text}`, 'ListParagraph', '<w:ind w:left="360"/>', links);
}

/**
 * A table, drawn to the width of the page.
 *
 * Percentage widths rather than absolute ones: a table sized in twips is a
 * table that runs off the page the first time somebody changes the margins,
 * and a document written on Letter and printed on A4 is the common case here
 * rather than the exotic one.
 */
function table(block: Extract<Block, { kind: 'table' }>, links?: Links): string {
  const width = block.rows.reduce((n, r) => Math.max(n, r.length), 0);
  if (width === 0) return '';
  const each = Math.floor(5000 / width);

  const borders =
    '<w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
      .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`)
      .join('') +
    '</w:tblBorders>';

  const rows = block.rows
    .map((row, r) => {
      const heading = block.header && r === 0;
      const cells = Array.from({ length: width }, (_, c) => {
        const text = row[c] ?? '';
        const bold = heading ? '<w:b/>' : '';
        const body =
          `<w:p><w:pPr><w:pStyle w:val="TableText"/>${bold ? `<w:rPr>${bold}</w:rPr>` : ''}</w:pPr>` +
          runs(text)
            .map((piece) => run({ ...piece, bold: piece.bold || heading }))
            .join('') +
          '</w:p>';
        return `<w:tc><w:tcPr><w:tcW w:w="${each}" w:type="pct"/></w:tcPr>${body}</w:tc>`;
      }).join('');
      // The header row repeats when a table runs over a page, which is the
      // one table setting people notice the absence of.
      const props = heading ? '<w:trPr><w:tblHeader/></w:trPr>' : '';
      return `<w:tr>${props}${cells}</w:tr>`;
    })
    .join('');

  const grid = `<w:tblGrid>${Array.from({ length: width }, () => '<w:gridCol w:w="1000"/>').join('')}</w:tblGrid>`;
  const tbl =
    '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/>' +
    `${borders}</w:tblPr>${grid}${rows}</w:tbl>`;

  // A caption after the table, in Word's own Caption style, so it is picked up
  // by a table of figures rather than being a small paragraph.
  return block.caption.trim() ? `${tbl}${para(block.caption, 'Caption', '', links)}` : `${tbl}<w:p/>`;
}

function blockXml(block: Block, doc: Doc, links?: Links): string {
  switch (block.kind) {
    case 'heading':
      return block.text.trim() ? para(block.text, `Heading${block.level}`, '', links) : '';
    case 'text':
      return block.text.trim() ? para(block.text, undefined, '', links) : '';
    case 'bullets':
      return block.items
        .filter((i) => i.trim())
        .map((i) => item(i, block.numbered, links))
        .join('');
    case 'checklist':
      return block.items
        .filter((i) => i.text.trim())
        .map((i) => ticked(i, links))
        .join('');
    case 'quote': {
      const body = block.text.trim() ? para(block.text, 'Quote', '', links) : '';
      return block.source.trim()
        ? `${body}${para(`— ${block.source}`, 'Caption', '', links)}`
        : body;
    }
    case 'table':
      return table(block, links);
    case 'equation': {
      if (!block.latex.trim()) return '';
      const math = omml(parse(block.latex));
      const body = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${math}</w:p>`;
      return block.caption.trim() ? `${body}${para(block.caption, 'Caption', '', links)}` : body;
    }
    /*
     * Code, one paragraph per line and no marks read in it.
     *
     * `para` would run the text through `runs`, which is exactly wrong here:
     * a shell command with a `*` in it is not italic. The runs are built by
     * hand so that what was typed is what lands in Word.
     */
    case 'code': {
      if (!block.text.trim()) return '';
      const lines = block.text.split('\n');
      const body = lines
        .map(
          (line) =>
            '<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr>' +
            `<w:r><w:t xml:space="preserve">${xml(line)}</w:t></w:r></w:p>`,
        )
        .join('');
      return block.language.trim()
        ? `${body}${para(block.language.trim(), 'Caption', '', links)}`
        : body;
    }
    /*
     * The contents, as the headings themselves.
     *
     * Not Word's `TOC` field, which is the obvious answer and a bad one here:
     * a field arrives unpopulated and shows "Right-click to update field"
     * until somebody does, and a contents page reading that is what gets
     * handed in. Real paragraphs in Word's own TOC styles are a contents page
     * that is right the moment the file opens, in Pages and Docs too.
     *
     * No page numbers, for the reason written on the block in
     * `lib/document.ts`: nothing here knows where Word will break a page.
     */
    case 'toc': {
      const headings = outline(doc);
      if (headings.length === 0) return '';
      return (
        para(block.title.trim() || 'Contents', 'Heading1') +
        headings
          .map((h) => para(h.text, `TOC${h.level}`))
          .join('')
      );
    }
    case 'break':
      return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  }
}

/**
 * The stylesheet, built round the layout.
 *
 * Sizes are in half-points, which is why an 11 is a 22. Every style names the
 * one it is based on, so a person restyling the document changes Normal and
 * the rest follows — which is the whole reason to define styles rather than
 * format directly.
 *
 * It was a constant until the page setup existed, which meant every document
 * this app has ever written was 11-point Calibri at Word's own 1.15 — and a
 * syllabus asking for double-spaced 12-point Times was answered by opening
 * Word and selecting all. The headings and the quotation scale with the body:
 * a 12-point document whose Heading 1 stayed at 16 is a document whose
 * headings are the wrong size, not a document with a fixed heading.
 *
 * `w:line` is twentieths of a point, so a multiple becomes `size × 20 ×
 * multiple`, and `w:lineRule="auto"` is what makes Word read it as a multiple
 * rather than as an exact height that clips a superscript.
 */
function stylesXml(layout: Layout): string {
  const half = Math.round(layout.size * 2);
  const line = Math.round(layout.size * 20 * lineHeight(layout.spacing));
  const font = xml(layout.font);
  /* Headings as multiples of the body size, so the ladder holds at any size. */
  const step = (times: number) => Math.round(half * times);
  /*
   * A double-spaced document does not want a blank line between paragraphs as
   * well: MLA asks for no extra space, and the gap Word puts there by default
   * is what makes an essay run a page long. Single spacing keeps it.
   */
  const after = layout.spacing === 'single' ? 160 : 0;

  return (
    `${HEAD}<w:styles xmlns:w="${W}">` +
    '<w:docDefaults><w:rPrDefault><w:rPr>' +
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="${half}"/>` +
    '</w:rPr></w:rPrDefault>' +
    `<w:pPrDefault><w:pPr><w:spacing w:after="${after}" w:line="${line}" w:lineRule="auto"/></w:pPr></w:pPrDefault>` +
    '</w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/>' +
    '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80"/></w:pPr>' +
    `<w:rPr><w:sz w:val="${step(2.55)}"/><w:b/></w:rPr></w:style>` +
    '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/>' +
    '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="320"/></w:pPr>' +
    `<w:rPr><w:sz w:val="${step(1.18)}"/><w:i/><w:color w:val="595959"/></w:rPr></w:style>` +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>' +
    '<w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/>' +
    '<w:spacing w:before="360" w:after="120"/></w:pPr>' +
    `<w:rPr><w:sz w:val="${step(1.45)}"/><w:b/></w:rPr></w:style>` +
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>' +
    '<w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/>' +
    '<w:spacing w:before="280" w:after="100"/></w:pPr>' +
    `<w:rPr><w:sz w:val="${step(1.18)}"/><w:b/></w:rPr></w:style>` +
    '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/>' +
    '<w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="2"/>' +
    '<w:spacing w:before="240" w:after="80"/></w:pPr>' +
    `<w:rPr><w:sz w:val="${step(1.09)}"/><w:b/><w:i/></w:rPr></w:style>` +
    '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/>' +
    '<w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720" w:right="720"/></w:pPr>' +
    '<w:rPr><w:i/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/>' +
    '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="240" w:line="240" w:lineRule="auto"/></w:pPr>' +
    `<w:rPr><w:sz w:val="${step(0.82)}"/><w:color w:val="595959"/></w:rPr></w:style>` +
    '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/>' +
    '<w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/>' +
    '<w:spacing w:after="60"/></w:pPr></w:style>' +
    /*
     * The three contents levels, in Word's own TOC styles.
     *
     * Named ones rather than indented paragraphs, so a person who deletes
     * this app's contents page and inserts Word's own gets the same look —
     * and so a PDF exported from Word carries the outline bookmarks.
     */
    [1, 2, 3]
      .map(
        (level) =>
          `<w:style w:type="paragraph" w:styleId="TOC${level}"><w:name w:val="toc ${level}"/>` +
          '<w:basedOn w:val="Normal"/><w:pPr>' +
          `<w:ind w:left="${(level - 1) * 360}"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>` +
          '</w:pPr></w:style>',
      )
      .join('') +
    /*
     * Code: single-spaced monospace with a rule down the left.
     *
     * Consolas rather than Courier — it is what Word has shipped since 2007
     * and what a reader on Windows will actually see; the fallback chain in
     * `w:rFonts` covers a Mac, where Word substitutes.
     */
    '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/>' +
    '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>' +
    '<w:ind w:left="360"/><w:pBdr><w:left w:val="single" w:sz="12" w:space="8" w:color="BFBFBF"/></w:pBdr></w:pPr>' +
    `<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="${step(0.82)}"/></w:rPr></w:style>` +
    '<w:style w:type="character" w:styleId="CodeChar"><w:name w:val="Code Char"/>' +
    `<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="${step(0.91)}"/></w:rPr></w:style>` +
    // A table cell is single-spaced: the document's own line spacing makes
    // every row taller than it needs to be, which is what turns a fifteen-row
    // table into two pages — and at double spacing, into four.
    '<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/>' +
    '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/></w:pPr>' +
    `<w:rPr><w:sz w:val="${step(0.91)}"/></w:rPr></w:style>` +
    '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/>' +
    '<w:tblPr><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>' +
    '<w:bottom w:w="80" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
    '</w:style>' +
    '</w:styles>'
  );
}

/** Bullets at `numId` 1, decimals at 2 — what `item()` above points at. */
const NUMBERING =
  `${HEAD}<w:numbering xmlns:w="${W}">` +
  '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0">' +
  '<w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/>' +
  '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>' +
  '<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr></w:lvl></w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0">' +
  '<w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/>' +
  '<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>' +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
  '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
  '</w:numbering>';

/** Every part of the package, by path. Exported so the test can read them. */
export function parts(doc: Doc): Record<string, string> {
  const out: Record<string, string> = {};
  const layout = layoutOf(doc);
  const header = layout.numbers || layout.runningHead.trim() !== '';

  out['[Content_Types].xml'] =
    `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    (header
      ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
      : '') +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>';

  out['_rels/.rels'] =
    `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>` +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/>` +
    '</Relationships>';

  /*
   * The body is written before the relationships, because writing it is what
   * discovers them. A link is a relationship id in the paragraph and a URL in
   * the rels part, so the two cannot be built in the order they are read.
   *
   * `Links` is told how many relationships this part already has, because
   * that number is not a constant any more: a document with a header has
   * three fixed ones and a document without has two. Handing it the wrong
   * number gives a link the header's own id, and Word opens a document whose
   * relationship points at the wrong part as unreadable rather than as a
   * broken link.
   */
  const links = new Links(header ? 3 : 2);
  const heading =
    (doc.title.trim() ? para(doc.title, 'Title', '', links) : '') +
    (doc.subtitle.trim() ? para(doc.subtitle, 'Subtitle', '', links) : '') +
    // A title page is the title, the subtitle and then the break. Written
    // here rather than as a block so that turning it off cannot leave a
    // stray page break behind in the document itself.
    (layout.titlePage && doc.title.trim() ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : '');
  const body = doc.blocks.map((block) => blockXml(block, doc, links)).join('');

  out['word/_rels/document.xml.rels'] =
    `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/numbering" Target="numbering.xml"/>` +
    (header ? `<Relationship Id="rId3" Type="${REL}/header" Target="header1.xml"/>` : '') +
    links.relationships() +
    '</Relationships>';

  out['word/document.xml'] =
    `${HEAD}<w:document xmlns:w="${W}" xmlns:m="${M}" xmlns:r="${REL}">` +
    `<w:body>${heading}${body}<w:sectPr>` +
    (header ? '<w:headerReference w:type="default" r:id="rId3"/>' : '') +
    `${pageXml(layout)}</w:sectPr></w:body></w:document>`;

  if (header) out['word/header1.xml'] = headerXml(layout);
  out['word/styles.xml'] = stylesXml(layout);
  out['word/numbering.xml'] = NUMBERING;

  const when = new Date(doc.updated || Date.now()).toISOString().replace(/\.\d+Z$/, 'Z');
  out['docProps/core.xml'] =
    `${HEAD}<cp:coreProperties ` +
    'xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
    'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${xml(doc.title)}</dc:title>` +
    (doc.subtitle.trim() ? `<dc:subject>${xml(doc.subtitle)}</dc:subject>` : '') +
    `<dcterms:created xsi:type="dcterms:W3CDTF">${when}</dcterms:created>` +
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${when}</dcterms:modified>` +
    '</cp:coreProperties>';

  out['docProps/app.xml'] =
    `${HEAD}<Properties ` +
    'xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
    'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>Semester</Application></Properties>';

  return out;
}

/** The finished file. */
export async function docx(doc: Doc): Promise<Blob> {
  const { zipSync } = await import('fflate');
  const encoder = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const [name, part] of Object.entries(parts(doc))) files[name] = encoder.encode(part);
  return new Blob([zipSync(files) as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
