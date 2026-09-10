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

/**
 * The named entities an OOXML part can carry, and the numeric ones.
 *
 * The numeric references are the half this missed. A line break inside a cell
 * is written `&#10;` by several writers, and leaving it undecoded imported the
 * six literal characters instead of a newline. Decimal and hex both, and both
 * before the `&amp;` pass — after it, a literal `&amp;#10;` in somebody's text
 * would have become a real newline, which is the same bug pointing the other
 * way.
 */
function entities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (whole, code) => {
      const n = Number(code);
      // A reference outside Unicode is not one; leave it as written rather
      // than throwing in the middle of somebody's spreadsheet.
      return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    })
    .replace(/&#x([0-9a-f]+);/gi, (whole, code) => {
      const n = Number.parseInt(code, 16);
      return Number.isFinite(n) && n <= 0x10ffff ? String.fromCodePoint(n) : whole;
    })
    .replace(/&amp;/g, '&');
}

/** Every `<t>` inside one shared string, joined — a rich-text run is still one string. */
function siText(block: string): string {
  const parts = [...block.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => entities(m[1]));
  return parts.join('');
}

/**
 * The number formats that mean "this is a date" — and only those.
 *
 * Excel stores a date as a count of days and a style saying to show it as one,
 * so a reader that ignores styles turns every due date into a five-digit
 * number.
 *
 * The trap is that the built-in ids do not divide where you would guess. 14 to
 * 17 are dates and 22 is a date and a time, but **18 to 21 and 45 to 47 are
 * times** — `h:mm`, `mm:ss`, `[h]:mm:ss` — and a time is a fraction of a day
 * with no date in it at all. Treating those as dates was measured turning a
 * cell holding half past midday into `1899-12-30`: the time thrown away and a
 * date invented in its place, which is the worst of both.
 *
 * So a time-formatted cell keeps its number. That reads as `0.5`, which is
 * unhelpful and honest; the alternative was a date nobody entered.
 */
const DATE_BUILT_IN = new Set([14, 15, 16, 17, 22]);

/** The built-in date formats that carry a time as well. */
const DATE_TIME_BUILT_IN = new Set([22]);

function dateFormats(stylesXml: string): { dates: Set<number>; times: Set<number> } {
  const dateFmtIds = new Set(DATE_BUILT_IN);
  const timeFmtIds = new Set(DATE_TIME_BUILT_IN);
  for (const m of stylesXml.matchAll(/<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
    // Bracketed parts are conditions and locales, quoted parts are literal
    // text; neither says anything about what the number means.
    const code = entities(m[2]).replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '');
    const hasDate = /[yd]/i.test(code) || /m{3,}/i.test(code);
    const hasTime = /[hs]/i.test(code);
    if (hasDate) {
      dateFmtIds.add(Number(m[1]));
      if (hasTime) timeFmtIds.add(Number(m[1]));
    }
  }

  /*
   * A cell points at a style, and the style points at a number format. Both
   * indirections have to be followed or the set above matches nothing: the
   * cell's `s=` is an index into `cellXfs`, not a format id.
   */
  const dates = new Set<number>();
  const times = new Set<number>();
  const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml);
  if (!xfs) return { dates, times };
  let at = 0;
  for (const m of xfs[1].matchAll(/<xf\b[^>]*>/g)) {
    const id = /numFmtId="(\d+)"/.exec(m[0]);
    if (id && dateFmtIds.has(Number(id[1]))) {
      dates.add(at);
      if (timeFmtIds.has(Number(id[1]))) times.add(at);
    }
    at += 1;
  }
  return { dates, times };
}

/**
 * The two epochs a workbook can count from.
 *
 * Excel for Mac counted days from 1904 and the setting survives in files to
 * this day, as `<workbookPr date1904="1"/>`. A reader that assumes 1900 puts
 * every date in such a file 1,462 days early — measured, a 2026 due date
 * imported as 2022 — and nothing about it looks wrong on screen.
 */
const EPOCH_1900 = Date.UTC(1899, 11, 30);
const EPOCH_1904 = Date.UTC(1904, 0, 1);

function epochOf(workbookXml: string): number {
  return /<workbookPr[^>]*date1904="(1|true)"/i.test(workbookXml) ? EPOCH_1904 : EPOCH_1900;
}

/**
 * Whether every function named in a formula is one `sheet.ts` can evaluate.
 *
 * A name check, not a parse: the engine refuses an unknown name and evaluates
 * everything else, so the question is only whether any name in the text is one
 * it does not have. Anything else it cannot handle still says so in the cell,
 * which is what a typed formula gets too.
 */
export function knownFormula(body: string): boolean {
  const names = body.toUpperCase().match(/\b[A-Z][A-Z0-9_.]*\s*\(/g) ?? [];
  return names.every((n) => KNOWN.has(n.replace(/\s*\($/, '')));
}

/**
 * Every function name the engine answers to.
 *
 * Kept beside the reader rather than exported from `sheet.ts`, because that
 * file's list is a `switch` and a switch cannot be iterated. A name missing
 * here costs a cached value, never a wrong number, which is the right way for
 * this list to be wrong.
 */
const KNOWN = new Set([
  'IF','IFS','IFERROR','SUMPRODUCT','AND','OR','NOT','COUNTA','CONCAT','LEN','UPPER','LOWER','TRIM',
  'VLOOKUP','HLOOKUP','XLOOKUP','INDEX','MATCH','LEFT','RIGHT','MID','SPLIT','TEXT',
  'TODAY','NOW','DATE','DATEDIF','WEEKDAY','EOMONTH',
  'COUNTIF','SUMIF','AVERAGEIF','COUNTIFS','SUMIFS',
  'SUM','PRODUCT','COUNT','AVERAGE','AVG','MEDIAN','MIN','MAX','STDEV','STDEVP','VAR','VARP',
  'ABS','INT','SQRT','EXP','LN','LOG10','POWER','MOD','ROUND','MODE','CORREL',
  'NPV','IRR','PMT','FV','PV','RATE',
]);

/**
 * A serial as the day it stands for, and the time too where the format has one.
 *
 * The day comes from the whole part and the time from the fraction, kept
 * apart: rounding the two together is how an afternoon becomes the next
 * morning.
 */
function isoDate(serial: number, epoch: number, withTime: boolean): string {
  const days = Math.floor(serial);
  const date = new Date(epoch + days * 86_400_000).toISOString().slice(0, 10);
  if (!withTime) return date;
  const seconds = Math.round((serial - days) * 86_400);
  const hh = String(Math.floor(seconds / 3600) % 24).padStart(2, '0');
  const mm = String(Math.floor(seconds / 60) % 60).padStart(2, '0');
  return `${date} ${hh}:${mm}`;
}

/**
 * A relationship target as a key into the zip.
 *
 * Targets are written relative to the part that declares them —
 * `xl/workbook.xml` — so `worksheets/sheet1.xml`, `/xl/worksheets/sheet1.xml`
 * and `../worksheets/sheet1.xml` are all things a writer may produce and all
 * name a real part. Prefixing `xl/` blindly turned the third into the literal
 * key `xl/../worksheets/sheet1.xml`, which matches nothing, so the worksheet
 * was skipped and the whole workbook reported as having none.
 *
 * The segments are walked instead: `..` goes up, `.` stays, everything else
 * descends. A leading slash is from the package root and starts over.
 */
function resolve(target: string): string {
  const from = target.startsWith('/') ? [] : ['xl'];
  for (const part of target.replace(/^\//, '').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') from.pop();
    else from.push(part);
  }
  return from.join('/');
}

/** Which worksheet part each tab in the workbook refers to. */
function worksheetOrder(workbook: string, rels: string): { name: string; part: string }[] {
  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /Id=['"]([^'"]+)['"]/.exec(m[0]);
    const target = /Target=['"]([^'"]+)['"]/.exec(m[0]);
    if (id && target) targets.set(id[1], resolve(entities(target[1])));
  }

  const out: { name: string; part: string }[] = [];
  let nth = 0;
  for (const m of workbook.matchAll(/<sheet\b[^>]*\/?>/g)) {
    nth += 1;
    const name = /name=['"]([^'"]*)['"]/.exec(m[0]);
    const rid = /r:id=['"]([^'"]+)['"]/.exec(m[0]);
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
  styles: { dates: Set<number>; times: Set<number> },
  epoch: number,
): {
  cells: Record<string, string>;
  rows: number;
  cols: number;
  over: boolean;
  /** Cells that inherited a shared formula and came in as their last value. */
  frozen: number;
  /** Cells whose formula this app cannot evaluate, kept as their last value. */
  unsupported: number;
} {
  const cells: Record<string, string> = {};
  let rows = 0;
  let cols = 0;
  let over = false;
  let frozen = 0;
  let unsupported = 0;

  for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = m[1];
    const body = m[2] ?? '';
    // Either quote style: `<c r='A1'>` is valid XML and was being skipped
    // outright, so a worksheet written that way imported as empty.
    const rref = /r=['"]([A-Z]+\d+)['"]/.exec(attrs);
    if (!rref) continue;
    const where = parseRef(rref[1]);
    if (!where) continue;
    if (where.row >= MAX_ROWS || where.col >= MAX_COLS) {
      over = true;
      continue;
    }

    const type = /t=['"]([^'"]+)['"]/.exec(attrs)?.[1] ?? 'n';
    const formula = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/.exec(body);
    const raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body);

    let text = '';
    const written = formula && formula[1].trim() ? entities(formula[1]).trim() : '';
    /*
     * A formula this engine cannot evaluate keeps its answer instead.
     *
     * `sheet.ts` says `#NAME?` for a function it does not have, which is the
     * right answer to something somebody typed and the wrong one to something
     * imported: Excel already worked `SUBTOTAL` out, the number is in the
     * file, and replacing it with an error throws away the only copy of it.
     */
    if (written && (!raw || knownFormula(written))) {
      text = `=${written}`;
    } else if (written) {
      unsupported += 1;
      text = entities(raw![1]);
    } else if (type === 'inlineStr') {
      text = siText(body);
    } else if (type === 's') {
      text = shared[Number(raw?.[1] ?? -1)] ?? '';
    } else if (type === 'b') {
      text = raw?.[1] === '1' ? 'TRUE' : 'FALSE';
    } else if (raw) {
      /*
       * A shared formula's followers.
       *
       * `<f t="shared" si="0"/>` carries no formula text — only the first cell
       * of the group has it, and every other row is meant to be derived from
       * it by shifting the references. Deriving them is real work and easy to
       * get subtly wrong, so they come in as the value Excel last computed:
       * correct today, and stale the moment somebody edits a cell it depended
       * on. That is a trade, so it is counted and said in `notes` rather than
       * left for somebody to discover in a total that stopped moving.
       */
      if (/<f\b/.test(body)) frozen += 1;

      const style = Number(/s=['"](\d+)['"]/.exec(attrs)?.[1] ?? -1);
      const n = Number(entities(raw[1]));
      text =
        type === 'n' && styles.dates.has(style) && Number.isFinite(n)
          ? isoDate(n, epoch, styles.times.has(style))
          : entities(raw[1]);
    }

    if (text === '') continue;
    cells[rref[1]] = text;
    rows = Math.max(rows, where.row + 1);
    cols = Math.max(cols, where.col + 1);
  }

  return { cells, rows, cols, over, frozen, unsupported };
}

/**
 * A workbook, as sheets this app can hold.
 *
 * Throws with something a person can act on rather than a parser's wording —
 * the commonest failure by far is an older .xls renamed rather than re-saved,
 * which is not a zip at all.
 */
/**
 * How much this will unpack before deciding the file is not a spreadsheet.
 *
 * `unzipSync` decompresses the whole archive into memory in one go, so a small
 * file claiming to hold a great deal is a frozen tab. A real .xlsx is a few
 * hundred kilobytes of XML per worksheet and this app's grid stops at 200×26,
 * so these are far past anything genuine and far short of anything a phone
 * cannot survive.
 */
const MOST_PACKED = 64 * 1024 * 1024;
const MOST_UNPACKED = 128 * 1024 * 1024;

export async function fromXlsx(file: File, courseId: CourseId | null = null): Promise<Read> {
  if (file.size > MOST_PACKED) {
    throw new Error(
      `${file.name} is too large for this app to open. Its grid stops at ${MAX_ROWS} rows and ` +
        `${MAX_COLS} columns — export the part you need as a CSV.`,
    );
  }
  const { unzipSync, strFromU8 } = await import('fflate');
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error(
      `${file.name} could not be opened as a spreadsheet. If it is an older .xls, open it and save it again as .xlsx — or export it as a CSV.`,
    );
  }

  /*
   * The unpacked total, checked before any of it becomes a string.
   *
   * The archive is already in memory by here — `unzipSync` offers no way to
   * stop part-way — but the strings are what multiply it, and refusing at this
   * point is the difference between a lot of memory briefly and a tab that
   * does not come back.
   */
  const unpacked = Object.values(zip).reduce((n, bytes) => n + bytes.length, 0);
  if (unpacked > MOST_UNPACKED) {
    throw new Error(
      `${file.name} unpacks to more than this app can hold. Export the sheet you need as a CSV.`,
    );
  }

  const part = (name: string): string => (zip[name] ? strFromU8(zip[name]) : '');
  const workbook = part('xl/workbook.xml');
  if (!workbook) throw new Error('That .xlsx has no workbook inside it.');

  const shared = [...part('xl/sharedStrings.xml').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(
    (m) => siText(m[1]),
  );
  const styles = dateFormats(part('xl/styles.xml'));
  const epoch = epochOf(workbook);

  const tabs = worksheetOrder(workbook, part('xl/_rels/workbook.xml.rels'));
  const sheets: Omit<Sheet, 'id'>[] = [];
  const notes: string[] = [];
  let truncated = false;
  let stale = 0;
  let unknown = 0;

  for (const tab of tabs) {
    const xml = part(tab.part);
    if (!xml) continue;
    const { cells, rows, cols, over, frozen, unsupported } = readCells(xml, shared, styles, epoch);
    truncated = truncated || over;
    stale += frozen;
    unknown += unsupported;
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
  if (stale > 0) {
    notes.push(
      `${stale} ${stale === 1 ? 'cell was' : 'cells were'} filled down from another cell's formula. ` +
        'Those came in as the number Excel last worked out, not as a formula, so they will not ' +
        'move if you change what they were adding up. Retype the formula in the first one and ' +
        'fill it down again to make them live.',
    );
  }
  if (unknown > 0) {
    notes.push(
      `${unknown} ${unknown === 1 ? 'formula uses a function' : 'formulas use functions'} this app ` +
        `does not have, so ${unknown === 1 ? 'it came' : 'they came'} in as the number Excel last ` +
        'worked out rather than as a formula.',
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

  /*
   * Cut to the grid before building the sheet, not after.
   *
   * `fromRows` caps `rows` and `cols` but writes every cell it was given, so a
   * 205-row file came in with `A201` onwards sitting outside the grid: not
   * drawn, not editable, and dropped by every export, which reads the grid
   * rather than the cell map. Silently — the sheet looked complete.
   */
  const over = rows.length > MAX_ROWS || rows.some((row) => row.length > MAX_COLS);
  const cut = rows.slice(0, MAX_ROWS).map((row) => row.slice(0, MAX_COLS));

  const title = file.name.replace(/\.(csv|tsv|txt)$/i, '');
  return {
    sheets: [{ ...fromRows(title, cut), courseId }],
    notes: over
      ? [
          `Anything past ${MAX_ROWS} rows or ${MAX_COLS} columns was left out — this app's grid stops there.`,
        ]
      : [],
  };
}

/** Which reader a picked file wants, or nothing when it is neither. */
export function readerFor(file: File): 'xlsx' | 'delimited' | null {
  if (/\.xlsx$/i.test(file.name)) return 'xlsx';
  if (/\.(csv|tsv|txt)$/i.test(file.name)) return 'delimited';
  return null;
}
