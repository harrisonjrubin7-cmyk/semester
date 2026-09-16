/**
 * The same document, exported twice, compared.
 *
 * `lib/docx.ts` writes a document as OOXML and `lib/pdfout.ts` writes it as a
 * PDF, by two entirely separate routes: one emits markup a word processor
 * lays out, the other measures every line and places it by hand. Nothing had
 * ever asked the two whether they agreed, and they did not. An equation
 * arrived in Word as a real equation object and in the PDF as the LaTeX
 * somebody had typed. A table's caption arrived in Word and in the PDF not at
 * all. A table running over three pages kept its `Term | Definition` strip in
 * Word and lost it in the PDF on pages two and three.
 *
 * Those are not rendering quirks. A student who exports to Word for a
 * supervisor and to PDF for the submission portal has handed in two different
 * documents, and the app said nothing about it.
 *
 * ## What this compares, and what it cannot
 *
 * Not pixels. A real visual diff needs Word, a PDF renderer and a browser in
 * one room, and this has to run in the suite. What it compares instead is
 * what a reader can *read*: for every block, the text that must survive and
 * the objects that must be present — a formula, a picture, a table's grid.
 * That is the axis every failure above was on, and it is checkable here.
 *
 * The obligations are written from the **block**, not from either exporter.
 * That is the whole point: two exporters that agree with each other and
 * disagree with the document are still wrong, and a comparison written from
 * one of them cannot see it.
 *
 * ## The control, which is the only reason to believe a clean reading
 *
 * [CLAUDE.md](../../../CLAUDE.md) records a teardown probe that read six
 * files as leaking, two of which were already fixed, and a second one that
 * read a leaking file as clean. A comparison that finds nothing is also
 * exactly what a broken comparison looks like. So `control()` is a document
 * that must fail, `fixture()` is one that must pass, and the test asserting
 * the second asserts the first in the same breath. If the control ever comes
 * back clean, nothing else in this file means anything.
 *
 * The control fails on something that will never be fixed, which is what
 * makes it a control rather than a bug report: text in a script the PDF's
 * encoding has no bytes for. `lib/pdf.ts` writes WinAnsi, deliberately and
 * for good reasons, so a paragraph of Japanese survives into Word and cannot
 * survive into the PDF. The comparison is right to say so, every time.
 */

import { blankDoc, runs, type Block, type Doc } from './document';
import { parts, type Picture } from './docx';
import { parse, plain } from './maths';
import { asPdf } from './pdf';
import { laid, type Page } from './pdfout';

/** Which export a finding is about. */
export type Side = 'docx' | 'pdf';

/** Something that is not text and has to be in the file all the same. */
export type Thing = 'formula' | 'picture' | 'table';

/** What one block obliges an export to carry. */
export interface Wanted {
  /** Text a reader must be able to read in the exported file. */
  text: string[];
  /** Everything in it that is not text. */
  things: Thing[];
}

/** One thing a block wanted and an export did not carry. */
export interface Missing {
  /** Which block, by its index in the document. */
  block: number;
  kind: Block['kind'];
  side: Side;
  /** The text that is not there, or the name of the thing that is not. */
  wanted: string;
  why: string;
}

/**
 * The words of a marked-up string, without the marks.
 *
 * The first version of `wanted` obliged both exports to contain
 * `A paragraph with *emphasis* in it` and both failed, correctly: the
 * asterisks are an instruction to set a word in italics, and an export that
 * printed them would be the broken one. A comparison is a claim about its own
 * probe as much as about what it measures, and this is where that one bit.
 */
function words(text: string): string {
  return runs(text)
    .map((r) => r.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * What a block obliges both exports to carry.
 *
 * An equation's LaTeX is deliberately not in `text`. Word gets a real
 * equation object and a PDF gets the notation spelled out, so neither is
 * obliged to contain `\frac` — what both are obliged to carry is a formula,
 * and the caption under it.
 */
export function wanted(block: Block): Wanted {
  switch (block.kind) {
    case 'heading':
    case 'text':
      return { text: [words(block.text)], things: [] };
    case 'bullets':
      return { text: block.items.map((i) => words(typeof i === 'string' ? i : i.text)), things: [] };
    case 'quote':
      return { text: [words(block.text), words(block.source)], things: [] };
    case 'table':
      return { text: [...block.rows.flat(), block.caption].map(words), things: ['table'] };
    case 'equation':
      return { text: [words(block.caption)], things: block.latex.trim() ? ['formula'] : [] };
    case 'code':
      return { text: block.text.split('\n'), things: [] };
    case 'checks':
      return { text: block.items.map((i) => words(i.text)), things: [] };
    case 'image':
      return { text: [words(block.caption)], things: block.fileId ? ['picture'] : [] };
    case 'toc':
      return { text: [words(block.title)], things: [] };
    default:
      return { text: [], things: [] };
  }
}

/**
 * A stand-in for a tag while the tags are being taken out.
 *
 * Written as an escape rather than as the character itself: a literal control
 * byte in a source file is invisible in every diff it ever appears in.
 */
const SPLIT = String.fromCharCode(1);

/** Tags out, entities back, runs of space collapsed: what Word will show. */
export function readable(xml: string): string {
  return (
    xml
      .replace(/<w:tab\/>/g, ' ')
      // A tag becomes a separator rather than nothing: two adjacent runs are
      // two words in Word and would otherwise be read here as one.
      .replace(/<[^>]+>/g, SPLIT)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(new RegExp(`${SPLIT}+`, 'g'), ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Everything drawn on a page, as one string, in the order it was placed.
 *
 * Through `asPdf`, which is the second thing the control caught — and then the
 * third. The pages `laid` returns hold the text as typed; the *file* holds one
 * byte per character from a 256-character encoding, and the conversion happens
 * on the way out. A comparison reading the layout is reading a document that
 * will never exist, and cannot see a single character the encoding drops.
 *
 * The round trip rather than `winAnsi` alone, because `winAnsi` returns bytes
 * and a byte is not a character. An em dash comes out of it as byte 0x97,
 * which is the em dash in the encoding the file declares and a control
 * character in Unicode — so a comparison against the document's own text read
 * every high character as lost, including the em dash in this fixture's table
 * caption, which had come through perfectly.
 */
export function pageText(page: Page): string {
  return page.drawings
    .filter((d) => d.at === 'text')
    .map((d) => asPdf(d.pieces.map((p) => p.text).join('')))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Text that has survived an export, compared the way a reader would.
 *
 * Whitespace is not the axis: a PDF breaks a paragraph into placed lines and
 * Word does not, so one has a line ending where the other has a space and
 * neither is wrong. Every character that carries meaning is.
 */
export function carries(carried: string, want: string): boolean {
  const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
  return tidy(carried).includes(tidy(want));
}

/** What the `.docx` carries, read back out of the markup it writes. */
export function inDocx(doc: Doc, found?: (id: string) => Picture | undefined): {
  text: string;
  count: (thing: Thing) => number;
} {
  const xml = parts(doc, found).text['word/document.xml'] ?? '';
  // Each tag is the element Word itself keys on rather than a name invented
  // here: `m:oMath` is an equation object, `a:blip` the picture in a drawing,
  // `w:tbl` the table.
  const tags: Record<Thing, string> = { formula: '<m:oMath', picture: '<a:blip', table: '<w:tbl>' };
  return {
    text: readable(xml),
    count: (thing) => xml.split(tags[thing]).length - 1,
  };
}

/**
 * What the `.pdf` carries, read back off the pages it lays out.
 *
 * A formula is counted by looking for the notation the PDF is supposed to
 * draw, because that is all a PDF has: unlike Word it has no object that
 * announces itself as an equation, and a check that looked for one would be
 * asking the format for something it does not have.
 */
export function inPdf(doc: Doc): { text: string; pages: Page[]; count: (thing: Thing) => number } {
  const { pages } = laid(doc);
  const text = pages.map(pageText).join(' ');
  const drawings = pages.flatMap((p) => p.drawings);
  return {
    text,
    pages,
    count: (thing) => {
      if (thing === 'table') return drawings.filter((d) => d.at === 'box').length ? 1 : 0;
      /*
       * Always none, and that is a statement about the PDF writer rather than
       * about this file. `lib/docx.ts` embeds the real picture; `lib/pdfout.ts`
       * draws `[Alt text]` in italics where one should be, so a document with a
       * picture in it genuinely does export as two different documents. It is
       * the one finding of this comparison still open — the `Drawing` union has
       * no picture to count, which is exactly why.
       */
      if (thing === 'picture') return 0;
      /*
       * Through `asPdf`, and this is the one obligation that goes through it.
       * The question here is whether the notation reached the file at all, and
       * a PDF that spells `α` as `alpha` has carried the formula — badly, on
       * purpose, for the reason `lib/pdf.ts` gives about not embedding a font.
       * The *text* obligations above stay strict on exactly the same evidence:
       * a paragraph whose words come out as spaces has not been carried, and
       * this is the difference between the two questions.
       */
      const said = doc.blocks
        .filter((b) => b.kind === 'equation' && b.latex.trim())
        .map((b) => asPdf(plain(parse((b as Extract<Block, { kind: 'equation' }>).latex))));
      return said.filter((s) => s.trim() && carries(text, s)).length;
    },
  };
}

/**
 * Every obligation a document's blocks put on its two exports, checked.
 *
 * Empty means the two files say what the document says. It does not mean they
 * look alike, which is a claim no test in this suite is entitled to make —
 * the note at the top of this file says which claim it is entitled to.
 */
export function compare(doc: Doc, found?: (id: string) => Picture | undefined): Missing[] {
  const out: Missing[] = [];
  const sides: [Side, { text: string; count: (thing: Thing) => number }][] = [
    ['docx', inDocx(doc, found)],
    ['pdf', inPdf(doc)],
  ];

  for (const [side, carried] of sides) {
    const owed: Record<Thing, number> = { formula: 0, picture: 0, table: 0 };
    for (const [at, block] of doc.blocks.entries()) {
      const want = wanted(block);
      for (const text of want.text) {
        if (!text.trim() || carries(carried.text, text)) continue;
        out.push({ block: at, kind: block.kind, side, wanted: text, why: 'not in the exported text' });
      }
      for (const thing of want.things) {
        owed[thing] += 1;
        if (carried.count(thing) >= owed[thing]) continue;
        out.push({ block: at, kind: block.kind, side, wanted: thing, why: 'no such object in the file' });
      }
    }
  }
  return out;
}

/**
 * A table's header row, on every page the table runs on to.
 *
 * Its own check, because the comparison above cannot see this one: the words
 * `Term` and `Definition` are both in the file, on page one, and a reader on
 * page three looking at a wall of unlabelled cells is not helped by that.
 * `lib/docx.ts` sets `w:tblHeader` and Word repeats the row, so the PDF is
 * the only side this can fail on.
 */
export function stranded(doc: Doc): string[] {
  const out: string[] = [];
  const { pages } = laid(doc);
  if (pages.length < 2) return out;
  const text = pages.map(pageText);

  for (const block of doc.blocks) {
    if (block.kind !== 'table' || !block.header || block.rows.length < 2) continue;
    const head = block.rows[0].filter((c) => c.trim());
    const body = block.rows.slice(1);
    if (!head.length) continue;
    for (const [i, on] of text.entries()) {
      const rows = body.some((r) => r.some((c) => c.trim() && carries(on, c)));
      if (rows && !head.every((cell) => carries(on, cell))) {
        out.push(`page ${i + 1} carries this table's rows without its header`);
      }
    }
  }
  return out;
}

/**
 * A document with one of everything in it, including the wide structures.
 *
 * Not "every block kind" for its own sake. It is every kind, plus the three
 * cases §5.1 of the completion plan named as checkable and unchecked: a table
 * long enough to cross a page boundary, a caption that must not be parted
 * from the thing it captions, and an equation that has to arrive as notation
 * rather than as source.
 */
export function fixture(): Doc {
  return {
    ...blankDoc('Fixture'),
    id: 'fixture',
    blocks: [
      { kind: 'heading', level: 1, text: 'What both exports must say' },
      { kind: 'text', text: 'A paragraph with *emphasis* and a bit of ordinary prose in it.' },
      { kind: 'bullets', items: ['First item', 'Second item'], numbered: false },
      { kind: 'checks', items: [{ text: 'A thing to do', done: false }] },
      { kind: 'quote', text: 'The state is not a neutral arbiter.', source: 'Trounstine, ch. 4' },
      { kind: 'equation', latex: 'E = mc^2', caption: 'Mass and energy' },
      { kind: 'code', text: 'const answer = 42;', language: 'ts' },
      {
        kind: 'table',
        rows: [
          ['Term', 'Definition'],
          ...Array.from({ length: 60 }, (_, i) => [`Term ${i}`, `What term ${i} means`]),
        ],
        header: true,
        caption: 'Table 1 — a table long enough to cross a page',
      },
      { kind: 'rule' },
      { kind: 'text', text: 'A closing paragraph, after the rule.' },
    ],
  };
}

/**
 * The control: a document the comparison has to fail on.
 *
 * It fails on the one difference between these two exports that is correct
 * and permanent. `lib/pdf.ts` writes WinAnsi — a deliberate choice, since the
 * alternative is embedding a font file in every export — and WinAnsi has no
 * byte for a Japanese character. Word carries the paragraph; the PDF cannot;
 * the comparison says so.
 *
 * That is why it is a control and not a bug report. Nobody will ever "fix"
 * it, so it cannot quietly stop failing the way a control built out of a real
 * defect does the day somebody fixes the defect.
 */
export function control(): Doc {
  return {
    ...blankDoc('Control'),
    id: 'control',
    blocks: [
      { kind: 'text', text: 'A paragraph that is genuinely in both files.' },
      { kind: 'text', text: '文字化けはPDFに入らない' },
    ],
  };
}
