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
import { listed, runs, type Align, type Block, type Doc, type Line } from './document';
import { layoutOf, lineHeight, pageSize, type Layout } from './doclayout';
import { omml, parse } from './maths';
import { HEAD, REL, xml } from './ooxml';
import { MEDIA_TYPE, fitted, type Pixels } from './imagesize';



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
  private readonly ids: Ids;

  constructor(ids: Ids) {
    this.ids = ids;
  }

  /** The relationship id for a target, making one if this is the first time. */
  id(target: string): string {
    const had = this.at.get(target);
    if (had) return had;
    const made = this.ids.next();
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
 * The next relationship id, for everything in the body that needs one.
 *
 * One counter shared by the links and the pictures rather than a block of
 * numbers each, because they share one namespace in `document.xml.rels` and a
 * duplicate id is a document Word offers to repair. Numbering them separately
 * is what produced one: the pictures were numbered after however many links
 * had been *met so far*, which is not the same as however many the document
 * has — a picture in the first paragraph and a link in the second both came
 * out as rId3. Handing ids out in the order they are asked for cannot
 * collide, whatever order the blocks are in.
 *
 * `fixed` is how many relationships the part already has before any of them.
 * It was a constant and stopped being one when a page header arrived: styles
 * and numbering are always there, and `header1.xml` is a third when the
 * layout asks for page numbers. Only `parts` knows, so only `parts` says —
 * and getting it wrong hands a link the header's own id, which Word opens as
 * an unreadable document rather than as a broken link.
 */
class Ids {
  private n: number;

  constructor(fixed = FIXED_RELS) {
    this.n = fixed;
  }

  next(): string {
    this.n += 1;
    return `rId${this.n}`;
  }
}

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
 * A picture, resolved before the document is written.
 *
 * The bytes and the size come in already read, rather than being fetched here:
 * they live in IndexedDB behind an async read, and `parts` is a pure function
 * of what it is handed — which is what lets the tests build a document without
 * a browser. The screen resolves them; see `pictureOf` in `screens/Write.tsx`.
 */
export interface Picture {
  bytes: Uint8Array;
  size: Pixels;
}

/**
 * How wide a picture may be, in inches.
 *
 * The page is 8.5 inches with one-inch margins — see `PAGE` — so 6.5 is the
 * text column exactly. A picture wider than that is not "slightly too wide":
 * Word draws exactly the size it is told, so it would run under the margin and
 * off the paper.
 */
const WIDEST_INCHES = 6.5;

/**
 * A picture as the drawing element Word reads.
 *
 * `wp:inline` rather than `wp:anchor` because this app's documents are a
 * column of blocks: a picture is a paragraph of its own, in the flow, not a
 * thing floated beside text with the words wrapped round it. Anchoring would
 * be a layout the editor above has no way to express.
 *
 * The two ids are not relationship ids and do not have to match anything —
 * `wp:docPr` wants a document-unique one, and the nested `pic:cNvPr` is the
 * shape's own. `descr` is the alt text, which is what a screen reader in Word
 * reads out, and is the reason the editor asks for it separately.
 */
function drawing(id: number, relId: string, pic: Picture, alt: string, name: string): string {
  const { cx, cy } = fitted(pic.size, WIDEST_INCHES);
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const PIC = 'http://schemas.openxmlformats.org/drawingml/2006/picture';
  const WP = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
  return (
    `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="${WP}">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${id}" name="${xml(name || `Picture ${id}`)}" descr="${xml(alt)}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${A}" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="${A}"><a:graphicData uri="${PIC}">` +
    `<pic:pic xmlns:pic="${PIC}">` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="${xml(name || `Picture ${id}`)}" descr="${xml(alt)}"/>` +
    '<pic:cNvPicPr/></pic:nvPicPr>' +
    `<pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/>' +
    `<a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>'
  );
}

/**
 * The pictures a document uses, as the package will file them.
 *
 * The same shape as `Links` and for the same reason: writing the body is what
 * discovers which pictures are in it, and each one needs a relationship id in
 * the paragraph, a part in the zip, and a content type declared for its
 * extension. Those three are written in three different places, so one object
 * hands out the id and remembers the rest.
 *
 * The ids come from the same counter the links draw on — see `Ids`, and the
 * duplicate that made it necessary.
 */
class Pictures {
  private readonly at = new Map<string, { id: string; file: string; pic: Picture }>();
  /*
   * Written out rather than taken as a constructor parameter property, which
   * `erasableSyntaxOnly` does not allow.
   */
  private readonly ids: Ids;

  constructor(ids: Ids) {
    this.ids = ids;
  }

  /** The relationship id for a picture, filing it if this is the first time. */
  id(key: string, pic: Picture): string {
    const had = this.at.get(key);
    if (had) return had.id;
    const made = {
      id: this.ids.next(),
      file: `image${this.at.size + 1}.${pic.size.kind}`,
      pic,
    };
    this.at.set(key, made);
    return made.id;
  }

  relationships(): string {
    return [...this.at.values()]
      .map(
        ({ id, file }) =>
          `<Relationship Id="${id}" Type="${REL}/image" Target="media/${file}"/>`,
      )
      .join('');
  }

  /** The binary parts, by the path they go in the package at. */
  media(): Record<string, Uint8Array> {
    const out: Record<string, Uint8Array> = {};
    for (const { file, pic } of this.at.values()) out[`word/media/${file}`] = pic.bytes;
    return out;
  }

  /** One `Default` per extension actually used — declaring unused ones is noise. */
  contentTypes(): string {
    const kinds = new Set([...this.at.values()].map(({ pic }) => pic.size.kind));
    return [...kinds]
      .map((kind) => `<Default Extension="${kind}" ContentType="${MEDIA_TYPE[kind]}"/>`)
      .join('');
  }
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
/**
 * A paragraph's alignment, as the property Word reads.
 *
 * `justify` is `both` in OOXML — the two edges — and `left` is written out
 * rather than left off, because a block set to left inside a document whose
 * style is justified means *this one is not*, and saying nothing would let
 * the style win.
 */
function aligned(align?: Align): string {
  if (!align) return '';
  return `<w:jc w:val="${align === 'justify' ? 'both' : align}"/>`;
}

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
function item(line: Line, numbered: boolean, links?: Links): string {
  const numbering =
    `<w:numPr><w:ilvl w:val="${line.level}"/>` +
    `<w:numId w:val="${numbered ? 2 : 1}"/></w:numPr>`;
  return para(line.text, 'ListParagraph', numbering, links);
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

function blockXml(
  block: Block,
  doc: Doc,
  links?: Links,
  pictures?: Pictures,
  found?: (fileId: string) => Picture | undefined,
  at = 1,
): string {
  switch (block.kind) {
    case 'heading':
      return block.text.trim()
        ? para(block.text, `Heading${block.level}`, aligned(block.align), links)
        : '';
    case 'text':
      return block.text.trim() ? para(block.text, undefined, aligned(block.align), links) : '';
    case 'bullets':
      return listed(block.items)
        .filter((l) => l.text.trim())
        .map((l) => item(l, block.numbered, links))
        .join('');
    case 'checks':
      return block.items
        .filter((i) => i.text.trim())
        .map((i) => ticked(i, links))
        .join('');
    case 'quote': {
      // The attribution takes the quotation's alignment too: the two are one
      // block on screen and one thing on the page, and a centred passage with
      // its source hard against the left margin reads as a mistake.
      const jc = aligned(block.align);
      const body = block.text.trim() ? para(block.text, 'Quote', jc, links) : '';
      return block.source.trim()
        ? `${body}${para(`— ${block.source}`, 'Caption', jc, links)}`
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
    /*
     * A picture, where one was resolved for it.
     *
     * A block whose file is missing writes its caption and nothing else, and
     * that is deliberate: the alternatives are an empty paragraph, which loses
     * the sentence somebody wrote about a picture, and a broken-image
     * placeholder, which is Word offering to repair the document. A file can
     * be missing for ordinary reasons — it was deleted from the drive, or the
     * document came in from markdown and never had one.
     */
    case 'image': {
      const pic = block.fileId && found ? found(block.fileId) : undefined;
      const body =
        pic && pictures
          ? drawing(at, pictures.id(block.fileId, pic), pic, block.alt, block.name)
          : '';
      return block.caption.trim() ? `${body}${para(block.caption, 'Caption', '', links)}` : body;
    }
    /*
     * A divider, as an empty paragraph with a line under it.
     *
     * Word has no horizontal-rule element — what the Borders button draws is
     * exactly this, a paragraph whose bottom border is on — so this is not a
     * workaround but the format's own answer. `w:sz` is in eighths of a
     * point, so 6 is the three-quarter-point hairline Word itself uses.
     *
     * The empty run is there on purpose: a `w:p` with no run at all is legal
     * and some readers collapse it away, taking the border with it.
     */
    case 'rule':
      return (
        '<w:p><w:pPr><w:pBdr>' +
        '<w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/>' +
        '</w:pBdr></w:pPr><w:r><w:t xml:space="preserve"></w:t></w:r></w:p>'
      );
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
     * Code: monospaced, a shade smaller, on a light ground — the three things
     * that make a snippet legible as a snippet rather than as an odd
     * paragraph. Single-spaced whatever the document is, because a
     * double-spaced listing is unreadable as code.
     *
     * Consolas rather than Courier: it is what Word has shipped since 2007
     * and what a reader on Windows will actually see, and `w:rFonts` covers
     * a Mac, where Word substitutes.
     */
    '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/>' +
    '<w:basedOn w:val="Normal"/>' +
    '<w:pPr><w:spacing w:before="120" w:after="120" w:line="240" w:lineRule="auto"/>' +
    '<w:ind w:left="360"/><w:shd w:val="clear" w:color="auto" w:fill="F4F4F4"/></w:pPr>' +
    `<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="${step(0.86)}"/></w:rPr></w:style>` +
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
/**
 * The numbering part, one definition per level a list may reach.
 *
 * A `w:ilvl` in a paragraph is a *reference*: Word looks the level up here for
 * its glyph, its indent and — for a numbered list — where its counter
 * restarts. Point at a level this part does not define and Word draws the
 * item at the left margin with no marker at all, which reads as a paragraph
 * that lost its bullet rather than as anything wrong with the file.
 *
 * The glyphs and formats cycle the way Word's own defaults do, so a nested
 * list looks like one a person made in Word: • ○ ▪ down the bullets, and
 * 1. a. i. down the numbers. `%1` through `%5` name the counters, and each
 * level shows only its own, which is the "1." "a." style rather than the
 * "1.a.i." legal one.
 *
 * `w:start` and `w:lvlRestart` are left at their defaults on purpose: Word
 * restarts a sub-list's numbering each time its parent advances, which is
 * what a reader expects and what `listMarkdown` writes on the other side.
 */
const BULLET_GLYPHS = ['\u2022', '\u25CB', '\u25AA', '\u2022', '\u25CB'];
const NUMBER_FORMATS = ['decimal', 'lowerLetter', 'lowerRoman', 'decimal', 'lowerLetter'];

/** Half an inch a level, which is Word's own step, in twips. */
const LEVEL_STEP = 720;

function levels(numbered: boolean): string {
  return Array.from({ length: 5 }, (_, at) => {
    const left = LEVEL_STEP * (at + 1);
    const format = numbered
      ? `<w:numFmt w:val="${NUMBER_FORMATS[at]}"/><w:lvlText w:val="%${at + 1}."/>`
      : `<w:numFmt w:val="bullet"/><w:lvlText w:val="${BULLET_GLYPHS[at]}"/>`;
    // Symbol is the font Word writes its own bullets in, and is what makes
    // the hollow and filled marks render as marks rather than as boxes.
    const font = numbered
      ? ''
      : '<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>';
    return (
      `<w:lvl w:ilvl="${at}"><w:start w:val="1"/>${format}<w:lvlJc w:val="left"/>` +
      `<w:pPr><w:ind w:left="${left}" w:hanging="360"/></w:pPr>${font}</w:lvl>`
    );
  }).join('');
}

const NUMBERING =
  `${HEAD}<w:numbering xmlns:w="${W}">` +
  `<w:abstractNum w:abstractNumId="0">${levels(false)}</w:abstractNum>` +
  `<w:abstractNum w:abstractNumId="1">${levels(true)}</w:abstractNum>` +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>' +
  '<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
  '</w:numbering>';

/** Every part of the package, by path. Exported so the test can read them. */
export function parts(
  doc: Doc,
  found: (fileId: string) => Picture | undefined = () => undefined,
): { text: Record<string, string>; media: Record<string, Uint8Array> } {
  const out: Record<string, string> = {};
  const layout = layoutOf(doc);
  const header = layout.numbers || layout.runningHead.trim() !== '';

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
  const ids = new Ids(header ? 3 : 2);
  const links = new Links(ids);
  const pictures = new Pictures(ids);
  const heading =
    (doc.title.trim() ? para(doc.title, 'Title', '', links) : '') +
    (doc.subtitle.trim() ? para(doc.subtitle, 'Subtitle', '', links) : '') +
    // A title page is the title, the subtitle and then the break. Written
    // here rather than as a block so that turning it off cannot leave a
    // stray page break behind in the document itself.
    (layout.titlePage && doc.title.trim() ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : '');
  const body = doc.blocks
    .map((block, i) => blockXml(block, doc, links, pictures, found, i + 1))
    .join('');

  out['word/_rels/document.xml.rels'] =
    `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/numbering" Target="numbering.xml"/>` +
    (header ? `<Relationship Id="rId3" Type="${REL}/header" Target="header1.xml"/>` : '') +
    links.relationships() +
    pictures.relationships() +
    '</Relationships>';

  out['word/document.xml'] =
    `${HEAD}<w:document xmlns:w="${W}" xmlns:m="${M}" xmlns:r="${REL}">` +
    `<w:body>${heading}${body}<w:sectPr>` +
    (header ? '<w:headerReference w:type="default" r:id="rId3"/>' : '') +
    `${pageXml(layout)}</w:sectPr></w:body></w:document>`;

  /*
   * Written after the body, not before it.
   *
   * A picture needs a `Default` for its extension declared here, and which
   * extensions are used is only known once the blocks have been walked. This
   * part used to be first, which was fine while every part of the package was
   * known in advance and is not any more — a package whose content types do
   * not cover a part in it is one Word refuses with "unreadable content".
   */
  out['[Content_Types].xml'] =
    `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    pictures.contentTypes() +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    (header
      ? '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>'
      : '') +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>';

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

  return { text: out, media: pictures.media() };
}

/**
 * The finished file.
 *
 * `found` resolves a picture's bytes, and is a plain function rather than an
 * async one so that everything below it stays synchronous: the caller does the
 * IndexedDB reading, which it has to anyway to show a preview.
 */
export async function docx(
  doc: Doc,
  found: (fileId: string) => Picture | undefined = () => undefined,
): Promise<Blob> {
  const { zipSync } = await import('fflate');
  const encoder = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  const made = parts(doc, found);
  for (const [name, part] of Object.entries(made.text)) files[name] = encoder.encode(part);
  for (const [name, bytes] of Object.entries(made.media)) files[name] = bytes;
  return new Blob([zipSync(files) as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}
