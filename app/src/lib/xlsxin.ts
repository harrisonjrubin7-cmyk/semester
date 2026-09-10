/**
 * Reading a .xlsx, the same way `extract.ts` reads a .docx: it is a zip with
 * XML in it, and the parts that matter are few enough to lift out by hand.
 *
 * `xlsx.ts` writes one without a library, for the reason given at the top of
 * that file. Reading one is the other half, and it is the half that decides
 * whether the app is somewhere a student can work: a gradebook that can only
 * be exported is a gradebook you have to start again in.
 *
 * ## The formulas come across
 *
 * A cell in a spreadsheet holds two things — what was typed and what it came
 * to — and a reader that takes only the second turns a sheet into a
 * photograph of itself. `=SUM(B2:B9)` arrives as `=SUM(B2:B9)`, is recomputed
 * by `sheet.ts` on this device, and goes back out as a formula when exported.
 * Where this file cannot read a formula it takes the cached value and says so
 * through `Read.notes`, rather than leaving a blank where a total was.
 *
 * ## Every worksheet arrives
 *
 * The app's `Sheet` is one grid, and a workbook can hold several. Dropping the
 * ones that do not fit would be data loss disguised as an import, so each
 * worksheet becomes its own sheet in the list, named after its tab. That is
 * not the same as tabs — moving between them is going back to the shelf, and
 * `Sheet2!A1` does not resolve across them — and `notes` says so plainly when
 * a workbook had more than one.
 *
 * ## What is not read
 *
 * Charts, pivot tables, conditional formatting, merged cells, colours, column
 * widths, data validation and defined names. None of them survive, because the
 * app has nowhere to put them. Anything a cell held that is not its text or
 * its formula is gone, and the file on disk is untouched — an import here is a
 * copy, never a move.
 */

import { blankSheet, colIndex, MAX_COLS, MAX_ROWS, parseRef, type Sheet } from './sheet';
import type { CourseId } from './types';

export interface Read {
  sheets: Omit<Sheet, 'id'>[];
  /** What the reader had to leave behind, in words meant for the student. */
  notes: string[];
}

/** The five entities an OOXML part can carry. Shared with `extract.ts`'s reader. */
function entities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Every `<t>` inside one shared string, joined — a rich-text run is still one string. */
function siText(block: string): string {
  const parts = [...block.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => entities(m[1]));
  return parts.join('');
}

/**
 * The number formats that mean "this is a date".
 *
 * Excel stores a date as a count of days and a style saying to show it as one,
 * so a reader that ignores styles turns every due date into a five-digit
 * number. The built-in ids below are fixed by the file format; a custom format
 * is a date if its code has a `y`, `d`, or a month `m` in it and no fraction.
 */
const DATE_BUILT_IN = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function dateFormats(stylesXml: string): Set<number> {
  const dateFmtIds = new Set(DATE_BUILT_IN);
  for (const m of stylesXml.matchAll(/<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
    const code = entities(m[2]).replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '');
    if (/[yd]/i.test(code) || /m{3,}/i.test(code)) dateFmtIds.add(Number(m[1]));
  }

  /*
   * A cell points at a style, and the style points at a number format. Both
   * indirections have to be followed or the set above matches nothing: the
   * cell's `s=` is an index into `cellXfs`, not a format id.
   */
  const out = new Set<number>();
  const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml);
  if (!xfs) return out;
  let at = 0;
  for (const m of xfs[1].matchAll(/<xf\b[^>]*>/g)) {
    const id = /numFmtId="(\d+)"/.exec(m[0]);
    if (id && dateFmtIds.has(Number(id[1]))) out.add(at);
    at += 1;
  }
  return out;
}

/** A serial back to the day it stands for, as `YYYY-MM-DD`. */
function isoDate(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial * 86_400_000);
  return new Date(ms).toISOString().slice(0, 10);
}

/** Which worksheet part each tab in the workbook refers to. */
function worksheetOrder(workbook: string, rels: string): { name: string; part: string }[] {
  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id="([^"]+)"/.exec(m[0]);
    const target = /Target="([^"]+)"/.exec(m[0]);
    if (id && target) {
      targets.set(id[1], `xl/${entities(target[1]).replace(/^\/?xl\//, '').replace(/^\.\//, '')}`);
    }
  }

  const out: { name: string; part: string }[] = [];
  let nth = 0;
  for (const m of workbook.matchAll(/<sheet\b[^>]*\/?>/g)) {
    nth += 1;
    const name = /name="([^"]*)"/.exec(m[0]);
    const rid = /r:id="([^"]+)"/.exec(m[0]);
    out.push({
      name: name ? entities(name[1]) : `Sheet${nth}`,
      // The relationship is the correct answer; the positional guess is what
      // is left when a writer omitted r:id, and it is right for every file
      // Excel, Numbers and Sheets produce.
      part: (rid && targets.get(rid[1])) || `xl/worksheets/sheet${nth}.xml`,
    });
  }
  return out;
}

/**
 * One worksheet's cells, by A1 reference.
 *
 * Anything past the grid's limits is dropped and reported rather than
 * silently truncated — a sheet whose last column vanished is worse than a
 * sheet you were told would not fit.
 */
function readCells(
  xml: string,
  shared: string[],
  dateStyles: Set<number>,
): { cells: Record<string, string>; rows: number; cols: number; over: boolean } {
  const cells: Record<string, string> = {};
  let rows = 0;
  let cols = 0;
  let over = false;

  for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = m[1];
    const body = m[2] ?? '';
    const rref = /r="([A-Z]+\d+)"/.exec(attrs);
    if (!rref) continue;
    const where = parseRef(rref[1]);
    if (!where) continue;
    if (where.row >= MAX_ROWS || where.col >= MAX_COLS) {
      over = true;
      continue;
    }

    const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? 'n';
    const formula = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(body);
    const raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body);

    let text = '';
    if (formula && formula[1].trim()) {
      // A shared formula (`<f t="shared" si="0"/>`) carries no body on the
      // rows that inherit it; those fall through to the cached value below,
      // which is why this checks the text rather than the tag.
      text = `=${entities(formula[1]).trim()}`;
    } else if (type === 'inlineStr') {
      text = siText(body);
    } else if (type === 's') {
      text = shared[Number(raw?.[1] ?? -1)] ?? '';
    } else if (type === 'b') {
      text = raw?.[1] === '1' ? 'TRUE' : 'FALSE';
    } else if (raw) {
      const style = Number(/s="(\d+)"/.exec(attrs)?.[1] ?? -1);
      const n = Number(entities(raw[1]));
      text =
        type === 'n' && dateStyles.has(style) && Number.isFinite(n)
          ? isoDate(n)
          : entities(raw[1]);
    }

    if (text === '') continue;
    cells[rref[1]] = text;
    rows = Math.max(rows, where.row + 1);
    cols = Math.max(cols, where.col + 1);
  }

  return { cells, rows, cols, over };
}

/**
 * A workbook, as sheets this app can hold.
 *
 * Throws with something a person can act on rather than a parser's wording —
 * the commonest failure by far is an older .xls renamed rather than re-saved,
 * which is not a zip at all.
 */
export async function fromXlsx(file: File, courseId: CourseId | null = null): Promise<Read> {
  const { unzipSync, strFromU8 } = await import('fflate');
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error(
      `${file.name} could not be opened as a spreadsheet. If it is an older .xls, open it and save it again as .xlsx — or export it as a CSV.`,
    );
  }

  const part = (name: string): string => (zip[name] ? strFromU8(zip[name]) : '');
  const workbook = part('xl/workbook.xml');
  if (!workbook) throw new Error('That .xlsx has no workbook inside it.');

  const shared = [...part('xl/sharedStrings.xml').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(
    (m) => siText(m[1]),
  );
  const dateStyles = dateFormats(part('xl/styles.xml'));

  const tabs = worksheetOrder(workbook, part('xl/_rels/workbook.xml.rels'));
  const sheets: Omit<Sheet, 'id'>[] = [];
  const notes: string[] = [];
  let truncated = false;

  for (const tab of tabs) {
    const xml = part(tab.part);
    if (!xml) continue;
    const { cells, rows, cols, over } = readCells(xml, shared, dateStyles);
    truncated = truncated || over;
    sheets.push({
      ...blankSheet(tab.name, courseId),
      cells,
      rows: Math.max(rows, 12),
      cols: Math.max(cols, 6),
    });
  }

  if (sheets.length === 0) throw new Error('That .xlsx has no worksheets in it.');
  if (sheets.length > 1) {
    notes.push(
      `${sheets.length} worksheets came in as ${sheets.length} separate sheets. A formula that referred across tabs will not find the other side.`,
    );
  }
  if (truncated) {
    notes.push(
      `Anything past ${MAX_ROWS} rows or ${colIndex('Z') + 1} columns was left out — this app's grid stops there.`,
    );
  }
  notes.push('Charts, pivot tables, colours and cell formats do not come across. The file itself is untouched.');

  return { sheets, notes };
}

/**
 * A CSV or TSV file.
 *
 * `sheet.ts`'s `readTable` already reads pasted text and works out which it
 * is. This is that, from a file, so the route in is the same whether somebody
 * pastes or picks.
 */
export async function fromDelimited(
  file: File,
  courseId: CourseId | null = null,
): Promise<Read> {
  const { readTable, fromRows } = await import('./sheet');
  const rows = readTable(await file.text());
  if (rows.length === 0) throw new Error(`${file.name} had no rows in it.`);
  const title = file.name.replace(/\.(csv|tsv|txt)$/i, '');
  return { sheets: [{ ...fromRows(title, rows), courseId }], notes: [] };
}

/** Which reader a picked file wants, or nothing when it is neither. */
export function readerFor(file: File): 'xlsx' | 'delimited' | null {
  if (/\.xlsx$/i.test(file.name)) return 'xlsx';
  if (/\.(csv|tsv|txt)$/i.test(file.name)) return 'delimited';
  return null;
}
