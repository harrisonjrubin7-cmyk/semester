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

import { runs, type Block, type Doc } from './document';
import { omml, parse } from './maths';
import { HEAD, REL, xml } from './ooxml';
import { MEDIA_TYPE, fitted, type Pixels } from './imagesize';



const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

/** US Letter in twentieths of a point, with one-inch margins. */
const PAGE = '<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>';

/**
 * One run of text.
 *
 * A line break inside a paragraph is `<w:br/>` rather than a new paragraph:
 * an address block or a verse quotation is one paragraph with breaks in it,
 * and splitting it into paragraphs would space every line as if it were one.
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

  /** Every one, as the relationship elements that go beside the two fixed ones. */
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

/** How many relationships `word/document.xml.rels` has before any link. */
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
 * Starts above the two fixed relationships the part always has: styles at
 * rId1 and numbering at rId2. See `parts`.
 */
class Ids {
  private n = FIXED_RELS;

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

function run(text: string, bold: boolean, italic: boolean, link = ''): string {
  const props = `${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}${link ? LINK_LOOK : ''}`;
  const pieces = text.split('\n');
  return pieces
    .map((piece, i) => {
      const br = i > 0 ? '<w:br/>' : '';
      return (
        `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}${br}` +
        `<w:t xml:space="preserve">${xml(piece)}</w:t></w:r>`
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
 * Text as itself: no emphasis read, no links found, every line kept.
 *
 * The counterpart to `run`, for the one block whose content is not prose. It
 * splits on newlines the same way, because a `<w:t>` cannot contain one and a
 * code block is mostly newlines.
 */
function raw(text: string): string {
  return text
    .split('\n')
    .map((line, i) => `<w:r>${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${xml(line)}</w:t></w:r>`)
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
      const piece = run(r.text, r.bold, r.italic, r.link);
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
 * A table, drawn to the width of the page.
 *
 * Percentage widths rather than absolute ones: a table sized in twips is a
 * table that runs off the page the first time somebody changes the margins,
 * and a document written on Letter and printed on A4 is the common case here
 * rather than the exotic one.
 */
function table(block: Extract<Block, { kind: 'table' }>): string {
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
            .map((piece) => run(piece.text, piece.bold || heading, piece.italic))
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
  return block.caption.trim() ? `${tbl}${para(block.caption, 'Caption')}` : `${tbl}<w:p/>`;
}

function blockXml(
  block: Block,
  links?: Links,
  pictures?: Pictures,
  found?: (fileId: string) => Picture | undefined,
  at = 1,
): string {
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
    case 'quote': {
      const body = block.text.trim() ? para(block.text, 'Quote', '', links) : '';
      return block.source.trim()
        ? `${body}${para(`— ${block.source}`, 'Caption', '', links)}`
        : body;
    }
    case 'table':
      return table(block);
    case 'equation': {
      if (!block.latex.trim()) return '';
      const math = omml(parse(block.latex));
      const body = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${math}</w:p>`;
      return block.caption.trim() ? `${body}${para(block.caption, 'Caption')}` : body;
    }
    /*
     * Code, as the characters it holds.
     *
     * `para` puts its text through `runs()` — the inline markdown reader — and
     * that is exactly what must not happen here: `**` in a shell glob would
     * come out as bold with the asterisks eaten. So this builds its runs
     * directly, with no marking up and no link parsing, and every line is a
     * separate `<w:br/>`-joined piece so the indentation survives.
     *
     * `xml:space="preserve"` is doing real work: without it Word drops the
     * leading spaces on every line, which is most of what code means.
     */
    case 'code': {
      if (!block.text.trim()) return '';
      return `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr>${raw(block.text)}</w:p>`;
    }
    /*
     * A checklist, as a list whose glyph says whether it is done.
     *
     * Word has no checkbox that survives being a plain paragraph — the real
     * one is a content control, which is a great deal of XML for a tick. The
     * ballot-box characters are what every exporter reaches for instead, they
     * are in every font Word ships, and they read correctly to somebody who
     * cannot see them: "ballot box with check" is what a screen reader says.
     */
    case 'checks':
      return block.items
        .filter((i) => i.text.trim())
        .map((i) => para(`${i.done ? '☒' : '☐'} ${i.text}`, 'ListParagraph', '', links))
        .join('');
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
    case 'break':
      return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
  }
}

/**
 * The stylesheet.
 *
 * Sizes are in half-points, which is why a 22 is 11pt. Every style names the
 * one it is based on, so a person restyling the document changes Normal and
 * the rest follows — which is the whole reason to define styles rather than
 * format directly.
 */
const STYLES =
  `${HEAD}<w:styles xmlns:w="${W}">` +
  '<w:docDefaults><w:rPrDefault><w:rPr>' +
  '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/>' +
  '</w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
  '</w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/>' +
  '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="80"/></w:pPr>' +
  '<w:rPr><w:sz w:val="56"/><w:b/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/>' +
  '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="320"/></w:pPr>' +
  '<w:rPr><w:sz w:val="26"/><w:i/><w:color w:val="595959"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>' +
  '<w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/>' +
  '<w:spacing w:before="360" w:after="120"/></w:pPr>' +
  '<w:rPr><w:sz w:val="32"/><w:b/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>' +
  '<w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/>' +
  '<w:spacing w:before="280" w:after="100"/></w:pPr>' +
  '<w:rPr><w:sz w:val="26"/><w:b/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/>' +
  '<w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:outlineLvl w:val="2"/>' +
  '<w:spacing w:before="240" w:after="80"/></w:pPr>' +
  '<w:rPr><w:sz w:val="24"/><w:b/><w:i/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/>' +
  '<w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720" w:right="720"/></w:pPr>' +
  '<w:rPr><w:i/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/>' +
  '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="0" w:after="240"/></w:pPr>' +
  '<w:rPr><w:sz w:val="18"/><w:color w:val="595959"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/>' +
  '<w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/>' +
  '<w:spacing w:after="60"/></w:pPr></w:style>' +
  // A table cell is single-spaced: the document's own 276-line spacing makes
  // every row a third taller than it needs to be, which is what turns a
  // fifteen-row table into two pages.
  // Monospaced, a shade smaller, on a light ground — the three things that
  // make a snippet legible as a snippet rather than as an odd paragraph.
  '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/>' +
  '<w:basedOn w:val="Normal"/>' +
  '<w:pPr><w:spacing w:before="120" w:after="120" w:line="240" w:lineRule="auto"/>' +
  '<w:ind w:left="360"/><w:shd w:val="clear" w:color="auto" w:fill="F4F4F4"/></w:pPr>' +
  '<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/>' +
  '<w:sz w:val="19"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/>' +
  '<w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/></w:pPr>' +
  '<w:rPr><w:sz w:val="20"/></w:rPr></w:style>' +
  '<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/>' +
  '<w:tblPr><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="108" w:type="dxa"/>' +
  '<w:bottom w:w="80" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr>' +
  '</w:style>' +
  '</w:styles>';

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
export function parts(
  doc: Doc,
  found: (fileId: string) => Picture | undefined = () => undefined,
): { text: Record<string, string>; media: Record<string, Uint8Array> } {
  const out: Record<string, string> = {};

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
   */
  const ids = new Ids();
  const links = new Links(ids);
  const pictures = new Pictures(ids);
  const heading =
    (doc.title.trim() ? para(doc.title, 'Title', '', links) : '') +
    (doc.subtitle.trim() ? para(doc.subtitle, 'Subtitle', '', links) : '');
  const body = doc.blocks
    .map((block, i) => blockXml(block, links, pictures, found, i + 1))
    .join('');

  out['word/_rels/document.xml.rels'] =
    `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/numbering" Target="numbering.xml"/>` +
    links.relationships() +
    pictures.relationships() +
    '</Relationships>';

  out['word/document.xml'] =
    `${HEAD}<w:document xmlns:w="${W}" xmlns:m="${M}" xmlns:r="${REL}">` +
    `<w:body>${heading}${body}<w:sectPr>${PAGE}</w:sectPr></w:body></w:document>`;

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
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>';

  out['word/styles.xml'] = STYLES;
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
