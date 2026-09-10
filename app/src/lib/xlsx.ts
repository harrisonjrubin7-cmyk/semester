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

import { asNumber, asPercent, filled, isFormula, ref, type Sheet } from './sheet';

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

export interface Tab {
  /** The name on the tab at the bottom. */
  name: string;
  rows: Cell[][];
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

function cellXml(address: string, cell: Cell, style: number): string {
  // A percentage carries its own format, which is a style — so it overrides
  // the row's. A header row of percentages is not a thing that happens.
  const index = cell.kind === 'percent' ? (cell.decimals > 0 ? PERCENT_2DP : PERCENT_0DP) : style;
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

function sheetXml(tab: Tab): string {
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
      const cells = row.map((cell, c) => cellXml(ref(r, c), cell, style)).join('');
      return cells ? `<row r="${r + 1}">${cells}</row>` : '';
    })
    .join('');

  return (
    `${HEAD}<worksheet xmlns="${MAIN}" xmlns:r="${REL}">` +
    `${view}${cols}<sheetData>${rows}</sheetData></worksheet>`
  );
}

/**
 * The style table: two cells' worth, and no more.
 *
 * A default and a bold. Every part below is required even when empty — a
 * `styles.xml` missing its `fills` or `borders` is the other reliable way to
 * produce a file Excel opens as blank, and the `gray125` fill at index 1 is
 * required to be there whether or not anything uses it.
 */
/** The two style indices past the default and the bold header. */
const PERCENT_0DP = 2;
const PERCENT_2DP = 3;

const STYLES =
  `${HEAD}<styleSheet xmlns="${MAIN}">` +
  '<fonts count="2">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  // 9 and 10 are `0%` and `0.00%`, two of the formats every reader has built
  // in — so no `numFmts` part is needed and nothing can point at a definition
  // that is not in the package.
  '<xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

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

  out['xl/styles.xml'] = STYLES;
  tabs.forEach((tab, i) => {
    out[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(tab);
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
  const rows: Cell[][] = shown.map((row, r) =>
    row.map((value, c) => {
      const raw = sheet.cells[ref(r, c)] ?? '';
      if (raw === '' && value === '') return { kind: 'blank' };
      if (isFormula(raw)) {
        return { kind: 'formula', source: raw.trimStart().slice(1), value };
      }
      // The header row is text even when it reads as a number: a column headed
      // "2026" is a heading, and writing it as a number right-aligns it away
      // from the column it names.
      if (header && r === 0) return { kind: 'text', value };
      const percent = asPercent(raw);
      if (percent) return { kind: 'percent', value: percent.value, decimals: percent.decimals };
      const n = asNumber(raw);
      return n === null ? { kind: 'text', value } : { kind: 'number', value: n };
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
