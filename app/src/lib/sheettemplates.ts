/**
 * Sheets somebody can start from.
 *
 * A blank grid is the hardest thing to start on, and it was the only thing
 * this app offered: New sheet, twelve by six, nothing in it. So the first
 * minute of every sheet went on typing the same four column headings a
 * gradebook, a budget or a problem set has always had.
 *
 * These are those four, built out of what a term actually contains rather than
 * out of a generic gallery: money that arrives and money that goes, hours
 * against a deadline, a set of readings to get through, a lab's readings and
 * their mean. Each one arrives with its formulas already in it, because a
 * template whose totals are blank has left out the part that was worth having.
 *
 * The one template that is not here is the gradebook: `lib/gradesheet.ts`
 * builds that from the course's own syllabus weights, which is a better sheet
 * than any fixed template could be, and `screens/Sheet.tsx` offers it beside
 * these.
 */

import { MAX_COLS, NEW_COLS, NEW_ROWS, ref, type CellStyle, type Cells, type Sheet } from './sheet';

export interface Template {
  id: string;
  /** What the card says. */
  label: string;
  /** The line under it — what this sheet is for, in one clause. */
  says: string;
  /** The rows, as they are typed. A `=` still means a formula. */
  rows: string[][];
  /** Pictures over particular cells or whole columns. */
  styles?: Record<string, CellStyle>;
}

const MONEY: CellStyle = { num: 'money', decimals: 2 };
const HEAD: CellStyle = { bold: true };

/**
 * A style for a column, from the second row down.
 *
 * Templates want "column C is money" and the model stores a style per cell, so
 * this is the loop that would otherwise be written out five times.
 */
function down(col: number, rows: number, style: CellStyle): Record<string, CellStyle> {
  const out: Record<string, CellStyle> = {};
  for (let r = 1; r <= rows; r += 1) out[ref(r, col)] = style;
  return out;
}

/** The heading row, bold, however wide it is. */
function heads(width: number): Record<string, CellStyle> {
  const out: Record<string, CellStyle> = {};
  for (let c = 0; c < width; c += 1) out[ref(0, c)] = HEAD;
  return out;
}

export const TEMPLATES: Template[] = [
  {
    id: 'todo',
    label: 'To-do list',
    says: 'What is due, when, and whether it is done',
    rows: [
      ['Task', 'Course', 'Due', 'Hours', 'Done'],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['', '', '', '', ''],
      ['Hours left', '', '', '=SUM(D2:D6)', ''],
    ],
    styles: { ...heads(5), A7: HEAD, D7: HEAD },
  },
  {
    id: 'month',
    label: 'Monthly budget',
    says: 'What comes in, what goes out, what is left',
    rows: [
      ['What', 'Planned', 'Actual', 'Difference'],
      ['Rent', '', '', '=C2-B2'],
      ['Food', '', '', '=C3-B3'],
      ['Books', '', '', '=C4-B4'],
      ['Travel', '', '', '=C5-B5'],
      ['Everything else', '', '', '=C6-B6'],
      ['In all', '=SUM(B2:B6)', '=SUM(C2:C6)', '=SUM(D2:D6)'],
    ],
    styles: {
      ...heads(4),
      ...down(1, 6, MONEY),
      ...down(2, 6, MONEY),
      ...down(3, 6, MONEY),
      A7: HEAD,
    },
  },
  {
    id: 'term',
    label: 'Term budget',
    says: 'A term’s money, month by month',
    rows: [
      ['', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Term'],
      ['Money in', '', '', '', '', '', '=SUM(B2:F2)'],
      ['Rent', '', '', '', '', '', '=SUM(B3:F3)'],
      ['Food', '', '', '', '', '', '=SUM(B4:F4)'],
      ['Books and fees', '', '', '', '', '', '=SUM(B5:F5)'],
      ['Everything else', '', '', '', '', '', '=SUM(B6:F6)'],
      ['Left', '=B2-SUM(B3:B6)', '=C2-SUM(C3:C6)', '=D2-SUM(D3:D6)', '=E2-SUM(E3:E6)', '=F2-SUM(F3:F6)', '=G2-SUM(G3:G6)'],
    ],
    styles: {
      ...heads(7),
      ...down(1, 6, MONEY),
      ...down(2, 6, MONEY),
      ...down(3, 6, MONEY),
      ...down(4, 6, MONEY),
      ...down(5, 6, MONEY),
      ...down(6, 6, MONEY),
      A7: HEAD,
    },
  },
  {
    id: 'readings',
    label: 'Reading tracker',
    says: 'Pages against the week, and how far through you are',
    rows: [
      ['Reading', 'Course', 'Pages', 'Read', 'Through'],
      ['', '', '', '', '=IF(C2=0,"",D2/C2)'],
      ['', '', '', '', '=IF(C3=0,"",D3/C3)'],
      ['', '', '', '', '=IF(C4=0,"",D4/C4)'],
      ['', '', '', '', '=IF(C5=0,"",D5/C5)'],
      ['In all', '', '=SUM(C2:C5)', '=SUM(D2:D5)', '=IF(C6=0,"",D6/C6)'],
    ],
    styles: { ...heads(5), ...down(4, 5, { num: 'percent' }), A6: HEAD },
  },
  {
    id: 'readings-lab',
    label: 'Lab readings',
    says: 'A column of measurements, with the statistics under it',
    rows: [
      ['Trial', 'Reading'],
      ['1', ''],
      ['2', ''],
      ['3', ''],
      ['4', ''],
      ['5', ''],
      ['Mean', '=AVERAGE(B2:B6)'],
      ['Std deviation', '=STDEV(B2:B6)'],
      ['Range', '=MAX(B2:B6)-MIN(B2:B6)'],
    ],
    styles: {
      ...heads(2),
      A7: HEAD,
      A8: HEAD,
      A9: HEAD,
      B7: { num: 'number', decimals: 3 },
      B8: { num: 'number', decimals: 3 },
      B9: { num: 'number', decimals: 3 },
    },
  },
];

/**
 * A template as a sheet ready to store.
 *
 * Deliberately not `fromRows`: that one trims a blank cell out and sizes the
 * grid to what is filled, which is right for a paste and wrong here — a
 * template is mostly empty on purpose, and the empty rows are the ones
 * somebody is about to type into.
 */
export function fromTemplate(template: Template, title: string): Omit<Sheet, 'id'> {
  const cells: Cells = {};
  template.rows.forEach((row, r) => {
    row.forEach((value, c) => {
      const text = value.trim();
      if (text) cells[ref(r, c)] = text;
    });
  });
  const wide = template.rows.reduce((n, row) => Math.max(n, row.length), 0);
  const now = Date.now();
  return {
    title: title.trim() || template.label,
    courseId: null,
    cells,
    styles: template.styles ?? {},
    rows: Math.max(NEW_ROWS, template.rows.length + 3),
    cols: Math.min(MAX_COLS, Math.max(NEW_COLS, wide)),
    created: now,
    updated: now,
  };
}
