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

/** XML text escaping. Every string that reaches the file goes through here. */
export function xml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const M = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** US Letter in twentieths of a point, with one-inch margins. */
const PAGE = '<w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>';

/**
 * One run of text.
 *
 * A line break inside a paragraph is `<w:br/>` rather than a new paragraph:
 * an address block or a verse quotation is one paragraph with breaks in it,
 * and splitting it into paragraphs would space every line as if it were one.
 */
function run(text: string, bold: boolean, italic: boolean): string {
  const props = `${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}`;
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

/** A paragraph of marked-up text in a named style. */
function para(text: string, style?: string, extra = ''): string {
  const props = style || extra ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${extra}</w:pPr>` : '';
  const body = runs(text)
    .map((r) => run(r.text, r.bold, r.italic))
    .join('');
  return `<w:p>${props}${body}</w:p>`;
}

/** A list item, at the numbering definition the list's kind points at. */
function item(text: string, numbered: boolean): string {
  const numbering = `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="${numbered ? 2 : 1}"/></w:numPr>`;
  return para(text, 'ListParagraph', numbering);
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

function blockXml(block: Block): string {
  switch (block.kind) {
    case 'heading':
      return block.text.trim() ? para(block.text, `Heading${block.level}`) : '';
    case 'text':
      return block.text.trim() ? para(block.text) : '';
    case 'bullets':
      return block.items
        .filter((i) => i.trim())
        .map((i) => item(i, block.numbered))
        .join('');
    case 'quote': {
      const body = block.text.trim() ? para(block.text, 'Quote') : '';
      return block.source.trim() ? `${body}${para(`— ${block.source}`, 'Caption')}` : body;
    }
    case 'table':
      return table(block);
    case 'equation': {
      if (!block.latex.trim()) return '';
      const math = omml(parse(block.latex));
      const body = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${math}</w:p>`;
      return block.caption.trim() ? `${body}${para(block.caption, 'Caption')}` : body;
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
export function parts(doc: Doc): Record<string, string> {
  const out: Record<string, string> = {};

  out['[Content_Types].xml'] =
    `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>';

  out['_rels/.rels'] =
    `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>` +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/>` +
    '</Relationships>';

  out['word/_rels/document.xml.rels'] =
    `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/numbering" Target="numbering.xml"/>` +
    '</Relationships>';

  const heading =
    (doc.title.trim() ? para(doc.title, 'Title') : '') +
    (doc.subtitle.trim() ? para(doc.subtitle, 'Subtitle') : '');
  const body = doc.blocks.map(blockXml).join('');

  out['word/document.xml'] =
    `${HEAD}<w:document xmlns:w="${W}" xmlns:m="${M}" xmlns:r="${REL}">` +
    `<w:body>${heading}${body}<w:sectPr>${PAGE}</w:sectPr></w:body></w:document>`;

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
