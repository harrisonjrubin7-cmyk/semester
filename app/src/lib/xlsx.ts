/**
 * A real Excel file, written in the browser.
 *
 * The same trick `pptx.ts` plays, for the same reason: a .xlsx is a zip of
 * XML, the app already carries fflate, and SheetJS is most of a megabyte to
 * write a grid of numbers. The parts a sheet of values and formulas touches
 * are small and have not moved since 2007.
 *
 * ## Why not just keep exporting CSV
 *
 * CSV was already here and it stays — it is the format everything reads. What
 * it cannot carry is the two things that make a sheet a sheet:
 *
 *   **A formula.** A CSV of a gradebook is the answers with the working thrown
 *   away. Reopen it in a month and the total is a number nobody can check,
 *   which is exactly the state this app exists to keep people out of.
 *
 *   **A type.** `09-14` is a date to Excel and `007` loses its noughts, both
 *   silently, because a CSV never said which cells were text. Here every cell
 *   says what it is, so a student number stays a student number.
 *
 * ## Two things that corrupt the file with no error
 *
 * Unescaped text — `&` in a heading is a parse error, reported as "we found
 * unreadable content" with no hint of where. Everything goes through `xml()`.
 *
 * And a cell whose declared type disagrees with its contents: a `t="n"` cell
 * holding letters opens as an empty workbook rather than as a broken one,
 * which is worse. `cellXml` decides the type from the value it is given
 * rather than from what the caller says it is.
 *
 * ## Formulas
 *
 * Both the formula and the value this app computed for it are written. Excel
 * recalculates on load — `fullCalcOnLoad` says so — but Numbers, Google
 * Sheets and every preview pane in a mail client show the stored value, and a
 * spreadsheet whose totals are blank until you open it in the right
 * application is a spreadsheet somebody will fill in by hand.
 */

import { asNumber, asPercent, filled, isFormula, picture, ref, styleOf, type Sheet } from './sheet';

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

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** One cell. What it is, rather than what it looks like. */
export type Cell =
  | { kind: 'blank' }
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number }
  /**
   * A number the person typed as a percentage.
   *
   * Written as the fraction with a percentage format on it, which is what
   * Excel means by a percentage — so the cell reads `80%`, sums correctly, and
   * is still 0.8 to anything that multiplies by it. Writing `80` instead would
   * make every weighted average a hundred times too big.
   */
  | { kind: 'percent'; value: number; decimals: number }
  /** The formula without its leading `=`, and what this app made of it. */
  | { kind: 'formula'; source: string; value: string };

/** A cell with the formatting somebody put on it, which most cells have none of. */
export type Formatted = Cell & { look?: Look };

/**
 * How a cell looks, as against what it is.
 *
 * The screen's `CellStyle` (see `lib/sheet.ts`) as this file needs it: a
 * number format code Excel reads, and the three weights. It is a second type
 * rather than the same one because the app's model says `{ num: 'money',
 * decimals: 2 }` and the file format says `$#,##0.00`, and the translation
 * between those is `picture()` — one function, called once, in `fromSheet`.
 *
 * Without this the export dropped every format somebody had applied: a column
 * shown as `80%` and `$1,234.50` on the screen arrived in Excel as `0.8` and
 * `1234.5`, which is the same loss a CSV of a gradebook is — the answers with
 * the working thrown away.
 */
export interface Look {
  /** An Excel number format code, or nothing for General. */
  fmt?: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface Tab {
  /** The name on the tab at the bottom. */
  name: string;
  rows: Formatted[][];
  /** Whether the first row is headings: bold, and frozen so it stays in view. */
  header: boolean;
  /** Column widths in characters, where the caller has an opinion. */
  widths?: number[];
}

export interface Book {
  tabs: Tab[];
}

/**
 * A tab name Excel will accept.
 *
 * Five characters are illegal and a name over 31 is refused, both by opening
 * the file with an error rather than by truncating. A sheet called
 * "ECON 1020: problem set 4" is an ordinary thing to want, so it is fixed here
 * rather than being a rule people have to know.
 */
export function tabName(title: string, fallback = 'Sheet1'): string {
  const clean = title.replace(/[[\]:*?/\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, 31) : fallback;
}

function cellXml(address: string, cell: Formatted, style: number, styles: Styles): string {
  /*
   * What the cell is formatted as, in the order the three ways of saying it
   * beat each other.
   *
   * A look somebody put on the cell wins: it is the only one of the three that
   * was chosen rather than inferred. Then a percentage the cell was *typed* as
   * — `80%` — which carries its own format, and overrides the row's, because a
   * header row of percentages is not a thing that happens. Then the row's.
   */
  const index = cell.look
    ? styles.index(cell.look)
    : cell.kind === 'percent'
      ? cell.decimals > 0
        ? PERCENT_2DP
        : PERCENT_0DP
      : style;
  const s = index ? ` s="${index}"` : '';
  if (cell.kind === 'blank') return '';
  if (cell.kind === 'percent') {
    return Number.isFinite(cell.value) ? `<c r="${address}"${s}><v>${cell.value}</v></c>` : '';
  }
  if (cell.kind === 'number') {
    // A value that is not finite has no XML representation — `NaN` in a `t="n"`
    // cell is one of the two ways this file corrupts silently.
    if (!Number.isFinite(cell.value)) return `<c r="${address}"${s} t="inlineStr"><is><t/></is></c>`;
    return `<c r="${address}"${s}><v>${cell.value}</v></c>`;
  }
  if (cell.kind === 'formula') {
    const n = Number(cell.value);
    const numeric = cell.value !== '' && Number.isFinite(n);
    return numeric
      ? `<c r="${address}"${s}><f>${xml(cell.source)}</f><v>${n}</v></c>`
      : `<c r="${address}"${s} t="str"><f>${xml(cell.source)}</f><v>${xml(cell.value)}</v></c>`;
  }
  return (
    `<c r="${address}"${s} t="inlineStr"><is><t xml:space="preserve">${xml(cell.value)}</t></is></c>`
  );
}

function sheetXml(tab: Tab, styles: Styles): string {
  const cols = tab.widths?.length
    ? `<cols>${tab.widths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : '';

  // A frozen header is the difference between a table you can read at row 40
  // and one where you scroll back up to remember which column is which.
  const view = tab.header
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" ' +
      'activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '';

  const rows = tab.rows
    .map((row, r) => {
      const style = tab.header && r === 0 ? 1 : 0;
      const cells = row.map((cell, c) => cellXml(ref(r, c), cell, style, styles)).join('');
      return cells ? `<row r="${r + 1}">${cells}</row>` : '';
    })
    .join('');

  return (
    `${HEAD}<worksheet xmlns="${MAIN}" xmlns:r="${REL}">` +
    `${view}${cols}<sheetData>${rows}</sheetData></worksheet>`
  );
}

/**
 * The style table, built from what the workbook actually uses.
 *
 * It was two cells' worth — a default and a bold, plus the two percentage
 * formats — written out as a constant, and that was the whole of what an
 * exported sheet could look like. Once a cell on the screen could carry a
 * picture and a weight, a fixed table meant one of two things: drop the
 * formatting on the way out, or write out every combination of format, font
 * and alignment whether or not anything used it. So it is assembled here from
 * the distinct {@link Look}s in the book.
 *
 * Every part below is required even when empty — a `styles.xml` missing its
 * `fills` or `borders` is the reliable way to produce a file Excel opens as
 * blank, and the `gray125` fill at index 1 is required to be there whether or
 * not anything uses it.
 *
 * ## The first four indices do not move
 *
 * Default, bold, `0%`, `0.00%` — in that order, always present, used or not.
 * `sheetXml` writes a header row as style 1 and a percentage as 2 or 3
 * directly, and a table whose indices shifted with the contents would make
 * those three numbers mean something different in every file.
 */
const PERCENT_0DP = 2;
const PERCENT_2DP = 3;

/** The looks that are always in the table, in the order their indices are fixed at. */
const FIXED: Look[] = [{}, { bold: true }, { fmt: '0%' }, { fmt: '0.00%' }];

/** One look as a string, so two cells asking for the same thing get one entry. */
function lookKey(look: Look): string {
  return [
    look.fmt ?? '',
    look.bold ? 'b' : '',
    look.italic ? 'i' : '',
    look.strike ? 's' : '',
    look.align ?? '',
  ].join('|');
}

/**
 * The number format id for a format code.
 *
 * `0%` and `0.00%` are 9 and 10, which every reader has built in — so those
 * two need no definition and nothing can point at a `numFmts` entry that is
 * not in the package. Anything else is defined as a custom format from 164,
 * which is where the format says custom ids start.
 */
function numFmtIds(looks: Look[]): { id: (fmt: string) => number; xml: string } {
  const custom = new Map<string, number>();
  for (const look of looks) {
    const fmt = look.fmt ?? '';
    if (fmt === '' || fmt === '0%' || fmt === '0.00%' || custom.has(fmt)) continue;
    custom.set(fmt, 164 + custom.size);
  }
  const id = (fmt: string) => {
    if (fmt === '') return 0;
    if (fmt === '0%') return 9;
    if (fmt === '0.00%') return 10;
    return custom.get(fmt) ?? 0;
  };
  const xml_ = custom.size
    ? `<numFmts count="${custom.size}">${[...custom]
        .map(([fmt, at]) => `<numFmt numFmtId="${at}" formatCode="${xml(fmt)}"/>`)
        .join('')}</numFmts>`
    : '';
  return { id, xml: xml_ };
}

/** A font as a string, for the same reason `lookKey` exists. */
function fontKey(look: Look): string {
  return `${look.bold ? 'b' : ''}${look.italic ? 'i' : ''}${look.strike ? 's' : ''}`;
}

export interface Styles {
  xml: string;
  /** Where a look sits in `cellXfs`. 0 for anything the table has no entry for. */
  index: (look: Look | undefined) => number;
}

export function styleTable(tabs: Tab[]): Styles {
  const looks: Look[] = [...FIXED];
  const seen = new Set(looks.map(lookKey));
  for (const tab of tabs) {
    for (const row of tab.rows) {
      for (const cell of row) {
        if (!cell.look) continue;
        const key = lookKey(cell.look);
        if (seen.has(key)) continue;
        seen.add(key);
        looks.push(cell.look);
      }
    }
  }

  const fonts = new Map<string, number>();
  for (const look of looks) {
    const key = fontKey(look);
    if (!fonts.has(key)) fonts.set(key, fonts.size);
  }
  const fontXml = [...fonts.keys()]
    .map(
      (key) =>
        '<font>' +
        (key.includes('b') ? '<b/>' : '') +
        (key.includes('i') ? '<i/>' : '') +
        (key.includes('s') ? '<strike/>' : '') +
        '<sz val="11"/><name val="Calibri"/></font>',
    )
    .join('');

  const numbers = numFmtIds(looks);
  const xfs = looks
    .map((look) => {
      const fmt = numbers.id(look.fmt ?? '');
      const font = fonts.get(fontKey(look)) ?? 0;
      const attrs =
        `numFmtId="${fmt}" fontId="${font}" fillId="0" borderId="0" xfId="0"` +
        (fmt ? ' applyNumberFormat="1"' : '') +
        (font ? ' applyFont="1"' : '') +
        (look.align ? ' applyAlignment="1"' : '');
      return look.align
        ? `<xf ${attrs}><alignment horizontal="${look.align}"/></xf>`
        : `<xf ${attrs}/>`;
    })
    .join('');

  const at = new Map(looks.map((look, i) => [lookKey(look), i]));
  return {
    xml:
      `${HEAD}<styleSheet xmlns="${MAIN}">` +
      numbers.xml +
      `<fonts count="${fonts.size}">${fontXml}</fonts>` +
      '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
      '<fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${looks.length}">${xfs}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>',
    index: (look) => (look ? (at.get(lookKey(look)) ?? 0) : 0),
  };
}

/** Every part of the package, by path. Exported so the test can read them. */
export function parts(book: Book): Record<string, string> {
  const tabs = book.tabs.length ? book.tabs : [{ name: 'Sheet1', rows: [], header: false }];
  const out: Record<string, string> = {};

  out['[Content_Types].xml'] =
    `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    tabs
      .map(
        (_, i) =>
          `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ` +
          'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
      )
      .join('') +
    '</Types>';

  out['_rels/.rels'] =
    `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>` +
    '</Relationships>';

  out['xl/_rels/workbook.xml.rels'] =
    `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    tabs
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('') +
    `<Relationship Id="rId${tabs.length + 1}" Type="${REL}/styles" Target="styles.xml"/>` +
    '</Relationships>';

  // Names have to be unique as well as legal, or the workbook opens with a
  // repair notice — two courses called "Sheet" is an ordinary accident.
  const used = new Set<string>();
  const names = tabs.map((tab, i) => {
    const wanted = tabName(tab.name, `Sheet${i + 1}`);
    let name = wanted;
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${wanted.slice(0, 28)} ${n++}`;
    used.add(name.toLowerCase());
    return name;
  });

  out['xl/workbook.xml'] =
    `${HEAD}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>` +
    names
      .map((name, i) => `<sheet name="${xml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('') +
    '</sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>';

  // Built once for the whole book rather than per sheet: `styles.xml` is one
  // part, and two tabs asking for `$#,##0.00` must land on the same index.
  const styles = styleTable(tabs);
  out['xl/styles.xml'] = styles.xml;
  tabs.forEach((tab, i) => {
    out[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(tab, styles);
  });

  return out;
}

/** The finished file. */
export async function xlsx(book: Book): Promise<Blob> {
  const { zipSync } = await import('fflate');
  const encoder = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const [name, body] of Object.entries(parts(book))) files[name] = encoder.encode(body);
  return new Blob([zipSync(files) as unknown as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * A stored sheet as a tab.
 *
 * The one place the format meets the app's own model. A cell holding a formula
 * is written as a formula with its computed value beside it; anything else is
 * a number if it reads as one and text otherwise — which is what keeps `007`
 * from becoming 7 and a date-shaped course code from becoming a date.
 */
export function fromSheet(sheet: Sheet, header = true): Tab {
  const shown = filled(sheet);
  const rows: Formatted[][] = shown.map((row, r) =>
    row.map((value, c) => {
      const address = ref(r, c);
      const raw = sheet.cells[address] ?? '';
      /*
       * The formatting somebody applied, translated once.
       *
       * `picture` turns the app's `{ num: 'money', decimals: 2 }` into the
       * format code the file wants, and it is the same function the screen
       * draws through — so the cell in Excel reads the way the cell on the
       * screen read, which is the whole promise of an export.
       *
       * A style with no picture and no weight on it is left off rather than
       * written as an empty look: it would be a `cellXfs` entry per cell that
       * somebody had bolded and unbolded.
       */
      const style = styleOf(sheet, address);
      const fmt = picture(style);
      const look: Look | undefined =
        style && (fmt || style.bold || style.italic || style.strike || style.align)
          ? {
              ...(fmt ? { fmt } : {}),
              ...(style.bold ? { bold: true } : {}),
              ...(style.italic ? { italic: true } : {}),
              ...(style.strike ? { strike: true } : {}),
              ...(style.align ? { align: style.align } : {}),
            }
          : undefined;
      const worn = <T extends Cell>(cell: T): Formatted => (look ? { ...cell, look } : cell);

      if (raw === '' && value === '') return worn({ kind: 'blank' });
      if (isFormula(raw)) {
        return worn({ kind: 'formula', source: raw.trimStart().slice(1), value });
      }
      // The header row is text even when it reads as a number: a column headed
      // "2026" is a heading, and writing it as a number right-aligns it away
      // from the column it names.
      if (header && r === 0) return worn({ kind: 'text', value });
      const percent = asPercent(raw);
      if (percent) {
        return worn({ kind: 'percent', value: percent.value, decimals: percent.decimals });
      }
      const n = asNumber(raw);
      return n === null ? worn({ kind: 'text', value }) : worn({ kind: 'number', value: n });
    }),
  );
  return { name: tabName(sheet.title), rows, header: header && rows.length > 1 };
}

/**
 * Column widths from the content, capped.
 *
 * Excel's own default is eight characters, which cuts every heading in this
 * app in half. Measuring is crude — the longest cell, plus two — and crude is
 * right: the alternative is font metrics for a font that is not installed on
 * the machine doing the measuring.
 */
export function widthsFor(rows: string[][], max = 42): number[] {
  const width = rows.reduce((n, r) => Math.max(n, r.length), 0);
  return Array.from({ length: width }, (_, c) =>
    Math.min(max, Math.max(9, ...rows.map((r) => (r[c] ?? '').length + 2))),
  );
}

/** `problem-set-4.xlsx`, from whatever the thing is called. */
export function sheetFileName(title: string): string {
  const stem = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join('-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  return `${stem || 'sheet'}.xlsx`;
}
