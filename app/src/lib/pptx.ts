/**
 * A real PowerPoint file, written in the browser.
 *
 * A .pptx is a zip of XML. The app already carries fflate — it reads .docx
 * syllabi with it — so the only thing missing was the XML, and that is what
 * this file is. No library: pptxgenjs is 400K to write eight text boxes, and
 * the parts of the format a deck of titles and bullets touches are small,
 * stable and have not changed since 2007.
 *
 * ## What it writes
 *
 * The smallest set of parts PowerPoint, Keynote and Google Slides will all
 * open: content types, the package relationships, one presentation part, one
 * master, one blank layout, a theme, and a part per slide. Every slide is a
 * background rectangle and text boxes at absolute positions. There is no
 * placeholder inheritance, which sounds like a shortcut and is in fact the
 * reliable path — inherited placeholders are where the three applications
 * disagree with each other.
 *
 * ## Two things that will silently corrupt the file
 *
 * Unescaped text. `&` in a title is a parse error, and PowerPoint reports a
 * parse error as "we found a problem with some content", with no hint. Every
 * string goes through `xml()`.
 *
 * And a wrong content type. A part registered as the wrong type opens as an
 * empty deck rather than failing, which is worse.
 *
 * Units are EMU: 914400 to the inch. The deck is 13.333in × 7.5in, which is
 * 16:9 at the size PowerPoint itself defaults to.
 */

const EMU = 914_400;
// PowerPoint's own widescreen page, to the EMU. 13.333 inches rounds to 305
// EMU short of it, which is invisible on screen and wrong in the file.
const W = 12_192_000;
const H = 6_858_000;

/** The app's own palette, so a deck and the screen it came from match. */
const INK = '0A0B0E';
const PAPER = 'E8EAEE';
const DIM = '949BA7';

export interface Slide {
  title: string;
  /** One line each. Empty for a title slide. */
  bullets: string[];
  /** Small text under the title — a unit name, a source, a date. */
  note?: string;
  /** A title slide is set bigger and centred. */
  opening?: boolean;
  /**
   * A real table on the slide, first row treated as headings.
   *
   * Drawn as a PowerPoint table rather than as a picture or a run of
   * tab-separated bullets, which are the two things every other "export to
   * slides" produces. A table you can edit in PowerPoint is the difference
   * between a deck somebody can fix in the ten minutes before a seminar and
   * one they have to rebuild.
   */
  table?: string[][];
  /**
   * An equation, as one line of ordinary text.
   *
   * Deliberately not OMML. PowerPoint can carry a real equation object, but
   * only inside an `mc:AlternateContent` block that Keynote and Google Slides
   * read differently — and a formula that renders in one application and
   * disappears in another is worse on a wall in front of a room than a plain
   * line that always renders. `lib/maths.ts` writes the line; see `plain()`
   * there for what it does and does not keep.
   */
  equation?: string;
  /**
   * What you say while this slide is up — the speaker's, not the room's.
   *
   * Written as a real `notesSlide` part rather than as small text on the slide
   * itself, which is the difference between a note that appears in
   * PowerPoint's presenter view and one the whole room reads off the wall.
   * `note` above is the other thing and stays the other thing: it is printed
   * on the slide, under the title, and is for a source or a unit name.
   */
  notes?: string;
}

export interface Deck {
  title: string;
  subtitle: string;
  slides: Slide[];
}

/** XML text escaping. Every string that reaches the file goes through here. */
export function xml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // A control character is legal in a JS string and not in XML 1.0.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

/** One text box. Positions and sizes are in inches, converted here. */
function box(
  id: number,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    lines: { text: string; size: number; color: string; bold?: boolean; bullet?: boolean }[];
    anchor?: 'ctr' | 't';
  },
): string {
  const paragraphs = opts.lines
    .map((line) => {
      const marker = line.bullet
        ? '<a:buFont typeface="Arial" pitchFamily="34" charset="0"/><a:buChar char="•"/>'
        : '<a:buNone/>';
      const indent = line.bullet ? ' marL="285750" indent="-285750"' : '';
      return (
        `<a:p><a:pPr${indent}>${marker}</a:pPr>` +
        `<a:r><a:rPr lang="en-US" sz="${Math.round(line.size * 100)}" b="${line.bold ? 1 : 0}" dirty="0">` +
        `<a:solidFill><a:srgbClr val="${line.color}"/></a:solidFill>` +
        '<a:latin typeface="Arial"/></a:rPr>' +
        `<a:t>${xml(line.text)}</a:t></a:r></a:p>`
      );
    })
    .join('');

  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="${Math.round(opts.x * EMU)}" y="${Math.round(opts.y * EMU)}"/>` +
    `<a:ext cx="${Math.round(opts.w * EMU)}" cy="${Math.round(opts.h * EMU)}"/></a:xfrm>` +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
    `<p:txBody><a:bodyPr wrap="square" anchor="${opts.anchor ?? 't'}"><a:normAutofit/></a:bodyPr>` +
    `<a:lstStyle/>${paragraphs}</p:txBody></p:sp>`
  );
}

/**
 * Body text sized to how much of it there is.
 *
 * A deck where every slide uses the same size has slides with four words in
 * 28pt and slides that run off the bottom. Autofit exists but Keynote and
 * Google Slides apply it differently, so the size is decided here where all
 * three will agree.
 */
export function bodySize(bullets: string[]): number {
  const chars = bullets.join(' ').length;
  if (bullets.length <= 3 && chars < 180) return 24;
  if (bullets.length <= 5 && chars < 380) return 20;
  if (bullets.length <= 7) return 17;
  return 15;
}

/**
 * A PowerPoint table.
 *
 * A `graphicFrame` rather than a shape, because that is what the format calls
 * a table, and the `uri` on the `graphicData` is what tells PowerPoint which
 * kind of graphic is inside — get it wrong and the slide opens with an empty
 * box rather than an error.
 *
 * Every cell carries its own fill and borders instead of naming a table style.
 * A style id refers to a definition in a part this package does not ship, and
 * the three applications disagree about what to do when it is missing:
 * PowerPoint substitutes its own blue banded style, which is not this app's
 * palette, and Google Slides draws nothing at all.
 *
 * The row height is a minimum rather than a size — PowerPoint grows a row to
 * fit its text and shrinks nothing — so a long cell wraps instead of being
 * clipped.
 */
function table(
  id: number,
  rows: string[][],
  at: { x: number; y: number; w: number },
): string {
  const columns = rows.reduce((n, row) => Math.max(n, row.length), 0);
  if (columns === 0) return '';
  const each = Math.round((at.w * EMU) / columns);
  // Smaller as the table grows: eight rows at 14pt is a readable slide and
  // sixteen at 14pt is a wall of text nobody at the back can read either way.
  const size = rows.length > 10 ? 1000 : rows.length > 6 ? 1200 : 1400;

  const cell = (text: string, heading: boolean) =>
    '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>' +
    `<a:p><a:pPr><a:buNone/></a:pPr><a:r><a:rPr lang="en-US" sz="${size}" b="${heading ? 1 : 0}">` +
    `<a:solidFill><a:srgbClr val="${heading ? PAPER : DIM}"/></a:solidFill>` +
    `<a:latin typeface="Arial"/></a:rPr><a:t>${xml(text)}</a:t></a:r></a:p></a:txBody>` +
    '<a:tcPr marL="68580" marR="68580" marT="45720" marB="45720">' +
    ['L', 'R', 'T', 'B']
      .map(
        (side) =>
          `<a:ln${side} w="6350"><a:solidFill><a:srgbClr val="${DIM}"><a:alpha val="45000"/>` +
          `</a:srgbClr></a:solidFill></a:ln${side}>`,
      )
      .join('') +
    `<a:solidFill><a:srgbClr val="${INK}"/></a:solidFill></a:tcPr></a:tc>`;

  const body = rows
    .map(
      (row, r) =>
        `<a:tr h="${Math.round(0.42 * EMU)}">` +
        Array.from({ length: columns }, (_, c) => cell(row[c] ?? '', r === 0)).join('') +
        '</a:tr>',
    )
    .join('');

  return (
    `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Table ${id}"/>` +
    '<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/>' +
    `</p:nvGraphicFramePr><p:xfrm><a:off x="${Math.round(at.x * EMU)}" y="${Math.round(at.y * EMU)}"/>` +
    `<a:ext cx="${Math.round(at.w * EMU)}" cy="${Math.round(rows.length * 0.42 * EMU)}"/></p:xfrm>` +
    '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>' +
    '<a:tblPr firstRow="1"/><a:tblGrid>' +
    Array.from({ length: columns }, () => `<a:gridCol w="${each}"/>`).join('') +
    `</a:tblGrid>${body}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
  );
}

function slideXml(slide: Slide): string {
  const shapes: string[] = [
    // The ground. Set per slide rather than on the master, because a master
    // background is the one thing Google Slides is happy to ignore.
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Ground"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
      `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${H}"/></a:xfrm>` +
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${INK}"/></a:solidFill>` +
      '<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>',
  ];

  if (slide.opening) {
    shapes.push(
      box(3, {
        x: 0.9,
        y: 2.3,
        w: 11.5,
        h: 2.4,
        anchor: 'ctr',
        lines: [{ text: slide.title, size: 40, color: PAPER, bold: true }],
      }),
    );
    if (slide.note) {
      shapes.push(
        box(4, {
          x: 0.9,
          y: 4.7,
          w: 11.5,
          h: 0.9,
          lines: [{ text: slide.note, size: 18, color: DIM }],
        }),
      );
    }
    return frame(shapes);
  }

  shapes.push(
    box(3, {
      x: 0.9,
      y: 0.7,
      w: 11.5,
      h: 1.3,
      lines: [{ text: slide.title, size: 28, color: PAPER, bold: true }],
    }),
  );

  let next = 4;
  if (slide.note) {
    shapes.push(
      box(next++, {
        x: 0.9,
        y: 1.95,
        w: 11.5,
        h: 0.5,
        lines: [{ text: slide.note, size: 13, color: DIM }],
      }),
    );
  }

  if (slide.equation) {
    shapes.push(
      box(next++, {
        x: 0.9,
        y: slide.table ? 2.1 : 2.9,
        w: 11.5,
        h: 1,
        anchor: 'ctr',
        lines: [{ text: slide.equation, size: 26, color: PAPER }],
      }),
    );
  }

  if (slide.table && slide.table.length) {
    shapes.push(
      table(next++, slide.table, {
        x: 0.9,
        y: slide.equation ? 3.3 : slide.note ? 2.6 : 2.2,
        w: 11.5,
      }),
    );
  }

  if (slide.bullets.length) {
    const size = bodySize(slide.bullets);
    shapes.push(
      box(next++, {
        x: 0.9,
        y: slide.note ? 2.6 : 2.2,
        w: 11.5,
        h: slide.note ? 4.2 : 4.6,
        lines: slide.bullets.map((text) => ({ text, size, color: PAPER, bullet: true })),
      }),
    );
  }

  return frame(shapes);
}

function frame(shapes: string[]): string {
  return (
    `${HEAD}<p:sld ${NS}><p:cSld><p:spTree>` +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
    '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    `${shapes.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
  );
}

const LAYOUT = `${HEAD}<p:sldLayout ${NS} type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;

const MASTER = `${HEAD}<p:sldMaster ${NS}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="${INK}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="dk1" tx1="lt1" bg2="dk2" tx2="lt2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`;

function themeXml(): string {
  const scheme = [
    ['dk1', INK],
    ['lt1', PAPER],
    ['dk2', '15171C'],
    ['lt2', 'C8CED8'],
    ['accent1', 'C8CED8'],
    ['accent2', '949BA7'],
    ['accent3', 'D8C79A'],
    ['accent4', 'A8CCBD'],
    ['accent5', 'AEBDD0'],
    ['accent6', 'D6A98D'],
    ['hlink', 'AEBDD0'],
    ['folHlink', '949BA7'],
  ]
    .map(([name, hex]) => `<a:${name}><a:srgbClr val="${hex}"/></a:${name}>`)
    .join('');

  const fill =
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
    '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const line =
    '<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
    '<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
    '<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>';
  const effect = '<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3);

  return (
    `${HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Semester">` +
    `<a:themeElements><a:clrScheme name="Semester">${scheme}</a:clrScheme>` +
    '<a:fontScheme name="Semester"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
    `<a:fmtScheme name="Semester"><a:fillStyleLst>${fill}</a:fillStyleLst>` +
    `<a:lnStyleLst>${line}</a:lnStyleLst><a:effectStyleLst>${effect}</a:effectStyleLst>` +
    `<a:bgFillStyleLst>${fill}</a:bgFillStyleLst></a:fmtScheme></a:themeElements>` +
    '<a:objectDefaults/><a:extraClrSchemeLst/></a:theme>'
  );
}

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const OFFICE = 'http://schemas.openxmlformats.org/package/2006/relationships';

function rels(entries: { id: string; type: string; target: string }[]): string {
  return (
    `${HEAD}<Relationships xmlns="${OFFICE}">` +
    entries
      .map((e) => `<Relationship Id="${e.id}" Type="${REL}/${e.type}" Target="${e.target}"/>`)
      .join('') +
    '</Relationships>'
  );
}

/**
 * The notes master, which a notes slide is not valid without.
 *
 * A `notesSlide` part has to point at one, the presentation has to list it,
 * and `[Content_Types]` has to declare it. Ship the notes without it and
 * PowerPoint opens the file with "we found a problem with some content" and
 * repairs it — which usually keeps the slides and drops the notes, so the
 * feature appears to work right up until the moment it is needed.
 *
 * Deliberately empty of styling. Everything it would carry is a default, and
 * a master that specifies nothing is a master every reader agrees about.
 */
const NOTES_MASTER =
  `${HEAD}<p:notesMaster ${NS}><p:cSld><p:spTree>` +
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
  '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
  '</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" ' +
  'accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" ' +
  'hlink="hlink" folHlink="folHlink"/></p:notesMaster>';

/**
 * One slide's speaker notes, as the part PowerPoint looks for.
 *
 * The shape is fixed by the format: a notes slide holds a placeholder pointing
 * back at the slide it belongs to (`type="sldImg"`) and a body placeholder
 * with the text. Leaving out the slide-image placeholder is the mistake that
 * makes PowerPoint repair the file on open, so it is here even though nothing
 * draws it.
 */
function notesXml(text: string): string {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const body = (lines.length ? lines : ['']).map(
    (line) => `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${xml(line)}</a:t></a:r></a:p>`,
  );
  return (
    `${HEAD}<p:notes ${NS}><p:cSld><p:spTree>` +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>' +
    '<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/>' +
    '<p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr>' +
    '<p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr>' +
    '<p:spPr/></p:sp>' +
    '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/>' +
    '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>' +
    '<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>' +
    '<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>' +
    body.join('') +
    '</p:txBody></p:sp>' +
    '</p:spTree></p:cSld></p:notes>'
  );
}

/**
 * The parts of the package, as a name-to-text map.
 *
 * Separated from the zipping so the whole format can be tested without a
 * browser: every part is a string, and a test can parse each one and check the
 * relationship graph closes.
 */
export function parts(deck: Deck): Record<string, string> {
  const slides = deck.slides.length ? deck.slides : [{ title: deck.title, bullets: [], opening: true }];
  const out: Record<string, string> = {};
  /** Whether anything in this deck needs the notes half of the package at all. */
  const anyNotes = slides.some((slide) => slide.notes?.trim());

  out['[Content_Types].xml'] =
    `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    slides
      .map(
        (_, i) =>
          `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
      )
      .join('') +
    // Only the slides that actually have notes get a part. An empty notes
    // slide on every slide is a file half again as large saying nothing.
    slides
      .map((slide, i) =>
        slide.notes?.trim()
          ? `<Override PartName="/ppt/notesSlides/notesSlide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`
          : '',
      )
      .join('') +
    (anyNotes
      ? '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>'
      : '') +
    '</Types>';

  out['_rels/.rels'] = rels([
    { id: 'rId1', type: 'officeDocument', target: 'ppt/presentation.xml' },
  ]);

  // The master takes rId1, the theme the id after the slides, so that the
  // slide ids and the slide numbers line up and stay readable.
  const presRels = [
    { id: 'rId1', type: 'slideMaster', target: 'slideMasters/slideMaster1.xml' },
    ...slides.map((_, i) => ({
      id: `rId${i + 2}`,
      type: 'slide',
      target: `slides/slide${i + 1}.xml`,
    })),
    { id: `rId${slides.length + 2}`, type: 'theme', target: 'theme/theme1.xml' },
    ...(anyNotes
      ? [
          {
            id: `rId${slides.length + 3}`,
            type: 'notesMaster',
            target: 'notesMasters/notesMaster1.xml',
          },
        ]
      : []),
  ];
  out['ppt/_rels/presentation.xml.rels'] = rels(presRels);

  out['ppt/presentation.xml'] =
    `${HEAD}<p:presentation ${NS} saveSubsetFonts="1">` +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    '<p:sldIdLst>' +
    slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('') +
    '</p:sldIdLst>' +
    (anyNotes
      ? `<p:notesMasterIdLst><p:notesMasterId r:id="rId${slides.length + 3}"/></p:notesMasterIdLst>`
      : '') +
    `<p:sldSz cx="${W}" cy="${H}"/><p:notesSz cx="${H}" cy="${W}"/></p:presentation>`;

  out['ppt/slideMasters/slideMaster1.xml'] = MASTER;
  out['ppt/slideMasters/_rels/slideMaster1.xml.rels'] = rels([
    { id: 'rId1', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' },
    { id: 'rId2', type: 'theme', target: '../theme/theme1.xml' },
  ]);

  out['ppt/slideLayouts/slideLayout1.xml'] = LAYOUT;
  out['ppt/slideLayouts/_rels/slideLayout1.xml.rels'] = rels([
    { id: 'rId1', type: 'slideMaster', target: '../slideMasters/slideMaster1.xml' },
  ]);

  out['ppt/theme/theme1.xml'] = themeXml();

  if (anyNotes) {
    out['ppt/notesMasters/notesMaster1.xml'] = NOTES_MASTER;
    // The master needs a theme of its own by the format's rules; the deck's
    // own is the right one, and reusing it keeps one set of colours.
    out['ppt/notesMasters/_rels/notesMaster1.xml.rels'] = rels([
      { id: 'rId1', type: 'theme', target: '../theme/theme1.xml' },
    ]);
  }

  slides.forEach((slide, i) => {
    out[`ppt/slides/slide${i + 1}.xml`] = slideXml(slide);
    const links = [
      { id: 'rId1', type: 'slideLayout', target: '../slideLayouts/slideLayout1.xml' },
    ];
    if (slide.notes?.trim()) {
      links.push({
        id: 'rId2',
        type: 'notesSlide',
        target: `../notesSlides/notesSlide${i + 1}.xml`,
      });
      out[`ppt/notesSlides/notesSlide${i + 1}.xml`] = notesXml(slide.notes);
      // The notes slide points back at its slide. Without this the graph does
      // not close and PowerPoint offers to repair the file.
      out[`ppt/notesSlides/_rels/notesSlide${i + 1}.xml.rels`] = rels([
        { id: 'rId1', type: 'notesMaster', target: '../notesMasters/notesMaster1.xml' },
        { id: 'rId2', type: 'slide', target: `../slides/slide${i + 1}.xml` },
      ]);
    }
    out[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = rels(links);
  });

  return out;
}

/** The finished file. */
export async function pptx(deck: Deck): Promise<Blob> {
  const { zipSync } = await import('fflate');
  const encoder = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const [name, body] of Object.entries(parts(deck))) {
    files[name] = encoder.encode(body);
  }
  return new Blob([zipSync(files) as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  });
}

export function deckFileName(title: string): string {
  const stem = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join('-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return `${stem || 'deck'}.pptx`;
}
