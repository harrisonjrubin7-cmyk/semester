/**
 * A chart inside a real workbook.
 *
 * The picture on the screen is drawn by `components/SheetChart.tsx` and is
 * only ever on the screen. A `.xlsx` with the numbers in it and no chart is a
 * half-export: the student's own copy of their gradebook opens in Excel
 * looking like the thing they made *before* they charted it, and the chart
 * they actually wanted to hand in has to be rebuilt by hand.
 *
 * ## It exports the reference, never the numbers
 *
 * A chart part could hold a copy of the values and Excel would draw it. It
 * would also be a second copy of the data inside the same file, so editing
 * `B4` in Excel would move nothing — a spreadsheet whose chart does not follow
 * its cells is the one thing nobody would accept from a spreadsheet.
 *
 * So every series is written as `'Term marks'!$B$2:$B$5`, which is what makes
 * it live. The cached values go in beside it, which looks like the copy just
 * argued against and is not: Excel recalculates and repaints from the
 * reference on open, and the cache is what every *other* reader — Numbers,
 * Google Sheets, a mail client's preview pane — draws before it has done any
 * of that. Without it the chart is an empty frame in all of them.
 *
 * ## The order of the elements is the format
 *
 * These schemas are sequences, not bags. `<c:cat>` after `<c:val>`, or
 * `<c:axPos>` before `<c:delete>`, produces a file Excel calls unreadable and
 * offers to repair — with no hint of which element, because the error is
 * reported against the part and not the line. Every builder below writes its
 * children in schema order, and the comments name the order where it is not
 * the obvious one.
 */

import { readChart, type ChartRead, type SheetChart } from './chart';
import { colName, type Cells, type Ctx } from './sheet';

const DRAWING_NS = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing';
const ART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

export const CHART_TYPE =
  'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';
export const DRAWING_TYPE = 'application/vnd.openxmlformats-officedocument.drawing+xml';

/** XML text escaping. The same rule as `xlsx.ts`, kept here so this file stands alone. */
function xml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * A sheet name as it appears inside a formula.
 *
 * Always quoted, and an apostrophe in it doubled. "Bo's marks" unquoted is a
 * reference to a sheet called `Bo` and then some text, and the chart comes up
 * empty with no error anywhere.
 */
export function sheetRef(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

/** An absolute address — `$B$4`. Charts reference absolutely, always. */
function fixed(row: number, col: number): string {
  return `$${colName(col)}$${row + 1}`;
}

/** `'Term marks'!$B$2:$B$5` for one column, or one cell when the ends meet. */
function span(sheet: string, col: number, from: number, to: number): string {
  const a = fixed(from, col);
  const b = fixed(to, col);
  return `${sheetRef(sheet)}!${a === b ? a : `${a}:${b}`}`;
}

/** The cached text behind a `<c:strRef>` — what a reader draws before it recalculates. */
function strCache(values: string[]): string {
  return (
    `<c:strCache><c:ptCount val="${values.length}"/>` +
    values.map((v, i) => `<c:pt idx="${i}"><c:v>${xml(v)}</c:v></c:pt>`).join('') +
    '</c:strCache>'
  );
}

/**
 * The cached numbers behind a `<c:numRef>`.
 *
 * A gap is written as *no point at that index* rather than as a zero — the
 * same distinction the drawing makes, and the reason `dispBlanksAs` is `gap`
 * below. A missing week charted as zero is a week somebody did no work, which
 * is a different claim from not knowing.
 */
function numCache(values: (number | null)[]): string {
  const points = values
    .map((v, i) => (v === null ? '' : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`))
    .join('');
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${points}</c:numCache>`;
}

/** The categories, shared by every series in the chart. */
function categories(sheetName: string, read: ChartRead): string {
  const { labelColumn, firstRow, lastRow } = read.at;
  if (labelColumn === null) {
    // No column of names, so the categories are the numbers 1..n and there is
    // nothing in the sheet to point at. The cache alone is legitimate here.
    return `<c:cat><c:strRef><c:f></c:f>${strCache(read.labels)}</c:strRef></c:cat>`;
  }
  return (
    '<c:cat><c:strRef>' +
    `<c:f>${xml(span(sheetName, labelColumn, firstRow, lastRow))}</c:f>` +
    strCache(read.labels) +
    '</c:strRef></c:cat>'
  );
}

/** A series' name, pointing at the heading cell it came from where there is one. */
function seriesName(sheetName: string, read: ChartRead, index: number): string {
  const s = read.series[index];
  const headerRow = read.at.headerRow;
  if (headerRow === null) {
    return `<c:tx><c:v>${xml(s.name)}</c:v></c:tx>`;
  }
  return (
    '<c:tx><c:strRef>' +
    `<c:f>${xml(`${sheetRef(sheetName)}!${fixed(headerRow, s.column)}`)}</c:f>` +
    strCache([s.name]) +
    '</c:strRef></c:tx>'
  );
}

function values(sheetName: string, read: ChartRead, index: number): string {
  const s = read.series[index];
  return (
    '<c:val><c:numRef>' +
    `<c:f>${xml(span(sheetName, s.column, read.at.firstRow, read.at.lastRow))}</c:f>` +
    numCache(s.values) +
    '</c:numRef></c:val>'
  );
}

/**
 * One series, in each family's own child order.
 *
 * `CT_BarSer` puts `invertIfNegative` before `cat`; `CT_LineSer` puts
 * `marker` there instead; `CT_PieSer` has neither. Writing one shape for all
 * three is what produces the repair notice.
 */
function series(sheetName: string, read: ChartRead, index: number, kind: SheetChart['kind']): string {
  const head =
    `<c:ser><c:idx val="${index}"/><c:order val="${index}"/>` + seriesName(sheetName, read, index);
  const middle =
    kind === 'line'
      ? '<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>'
      : kind === 'pie'
        ? ''
        : '<c:invertIfNegative val="0"/>';
  const tail =
    categories(sheetName, read) + values(sheetName, read, index) + (kind === 'line' ? '<c:smooth val="0"/>' : '');
  return `${head}${middle}${tail}</c:ser>`;
}

/** Two axis ids, distinct within the part and stable so a diff of two files is readable. */
const CAT_AX = 111111111;
const VAL_AX = 222222222;

function axes(sideways: boolean): string {
  return (
    `<c:catAx><c:axId val="${CAT_AX}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="${sideways ? 'l' : 'b'}"/>` +
    `<c:crossAx val="${VAL_AX}"/></c:catAx>` +
    `<c:valAx><c:axId val="${VAL_AX}"/><c:scaling><c:orientation val="minMax"/></c:scaling>` +
    `<c:delete val="0"/><c:axPos val="${sideways ? 'b' : 'l'}"/>` +
    '<c:majorGridlines/>' +
    `<c:crossAx val="${CAT_AX}"/><c:crossBetween val="between"/></c:valAx>`
  );
}

function title(text: string): string {
  if (!text) return '<c:autoTitleDeleted val="1"/>';
  return (
    '<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r>' +
    `<a:t>${xml(text)}</a:t>` +
    '</a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>' +
    '<c:autoTitleDeleted val="0"/>'
  );
}

/** The whole chart part, for one chart. */
export function chartXml(sheetName: string, chart: SheetChart, read: ChartRead): string {
  /*
   * A pie exports the one series it draws.
   *
   * The format allows several and Excel then draws the first and ignores the
   * rest — so a two-series pie is a file that disagrees with itself, and with
   * the picture on the screen, which says plainly that a pie is one series.
   * See `chartNote` in `lib/chart.ts`.
   */
  const drawn = chart.kind === 'pie' ? read.series.slice(0, 1) : read.series;
  const all = drawn.map((_, i) => series(sheetName, read, i, chart.kind)).join('');

  const plot =
    chart.kind === 'pie'
      ? `<c:pieChart><c:varyColors val="1"/>${all}<c:firstSliceAng val="0"/></c:pieChart>`
      : chart.kind === 'line'
        ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${all}` +
          `<c:marker val="1"/><c:axId val="${CAT_AX}"/><c:axId val="${VAL_AX}"/></c:lineChart>` +
          axes(false)
        : `<c:barChart><c:barDir val="${chart.kind === 'bar' ? 'bar' : 'col'}"/>` +
          `<c:grouping val="clustered"/><c:varyColors val="0"/>${all}` +
          `<c:gapWidth val="50"/><c:overlap val="-10"/>` +
          `<c:axId val="${CAT_AX}"/><c:axId val="${VAL_AX}"/></c:barChart>` +
          axes(chart.kind === 'bar');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<c:chartSpace xmlns:c="${CHART_NS}" xmlns:a="${ART_NS}" xmlns:r="${REL_NS}">` +
    '<c:chart>' +
    title(chart.title) +
    `<c:plotArea><c:layout/>${plot}</c:plotArea>` +
    (drawn.length > 1 || chart.kind === 'pie'
      ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>'
      : '') +
    '<c:plotVisOnly val="1"/>' +
    // The other half of writing a gap as no point at all. See `numCache`.
    '<c:dispBlanksAs val="gap"/>' +
    '</c:chart></c:chartSpace>'
  );
}

/** How tall a chart is drawn in the sheet, in rows, and how wide in columns. */
const FRAME = { cols: 8, rows: 16, gap: 2 };

/**
 * The drawing part: where each chart sits on the sheet.
 *
 * Anchored to cells rather than to a fixed offset, so a chart is still beside
 * its numbers after somebody widens a column. They are stacked down the sheet
 * starting two rows under the last row of data, which is where somebody would
 * have put the first one.
 */
export function drawingXml(count: number, below: number): string {
  const anchors = Array.from({ length: count }, (_, i) => {
    const top = below + FRAME.gap + i * (FRAME.rows + FRAME.gap);
    return (
      '<xdr:twoCellAnchor>' +
      `<xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${top}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>` +
      `<xdr:to><xdr:col>${FRAME.cols}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${top + FRAME.rows}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>` +
      '<xdr:graphicFrame macro="">' +
      '<xdr:nvGraphicFramePr>' +
      // Ids are unique within the part and must not be 0 or 1.
      `<xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/>` +
      '</xdr:nvGraphicFramePr>' +
      '<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>' +
      `<a:graphic><a:graphicData uri="${CHART_NS}">` +
      `<c:chart xmlns:c="${CHART_NS}" xmlns:r="${REL_NS}" r:id="rId${i + 1}"/>` +
      '</a:graphicData></a:graphic>' +
      '</xdr:graphicFrame>' +
      '<xdr:clientData/>' +
      '</xdr:twoCellAnchor>'
    );
  }).join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<xdr:wsDr xmlns:xdr="${DRAWING_NS}" xmlns:a="${ART_NS}">${anchors}</xdr:wsDr>`
  );
}

/** The drawing's own relationships — one per chart it frames. */
export function drawingRels(count: number, firstChart: number): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    Array.from(
      { length: count },
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="${REL_NS}/chart" Target="../charts/chart${firstChart + i}.xml"/>`,
    ).join('') +
    '</Relationships>'
  );
}

/** A worksheet's relationships — the one drawing on it. */
export function sheetRels(drawing: number): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="${REL_NS}/drawing" Target="../drawings/drawing${drawing}.xml"/>` +
    '</Relationships>'
  );
}

/**
 * The charts of one sheet, read and ready to write.
 *
 * A chart that cannot be read — a range somebody edited to nonsense, a block
 * of words — is left out of the file rather than written as an empty frame.
 * The screen says what is wrong with it; a workbook cannot, so it carries the
 * numbers and no picture, which is the honest half.
 */
export function readable(
  cells: Cells,
  charts: SheetChart[],
  ctx?: Ctx,
): { chart: SheetChart; read: ChartRead }[] {
  return charts
    .map((chart) => ({ chart, read: readChart(cells, chart, ctx) }))
    .filter(({ read }) => read.trouble === '');
}
