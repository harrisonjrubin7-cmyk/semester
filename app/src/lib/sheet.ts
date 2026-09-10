/**
 * A grid of cells, and the arithmetic that reads it.
 *
 * The app could already turn a semester into CSV and could already read a CSV
 * somebody dropped on it. What it could not do is the thing in between — hold
 * a table, let you type into it, and add a column up. So every gradebook,
 * every problem set's working, every budget for a group project happened in a
 * different application and came back as a screenshot.
 *
 * This is the model. `xlsx.ts` writes the file, `screens/Sheet.tsx` draws it,
 * and everything here is pure: a sheet in, a number or a string out, no DOM
 * and no clock. That split is what lets the formula engine be tested properly,
 * and a formula engine that is not tested properly is a calculator that lies.
 *
 * ## What a cell holds
 *
 * Text, always. `"12"`, `"Midterm"`, `"=SUM(B2:B9)"` — one field, and what it
 * means is decided when it is read rather than when it is typed. A cell that
 * remembered it was "a number" would have to be re-typed to become a formula,
 * and the person typing does not think of it that way.
 *
 * Absent is empty. There is no row of empty strings behind the grid: `cells`
 * holds only what somebody has actually written, so a sheet with four values
 * in it is four entries however far the grid has been dragged out.
 *
 * ## What the engine will not do
 *
 * It will not guess. An unknown function name is `#NAME?`, a reference to
 * nothing is `#REF!`, a cell that refers to itself is `#CYCLE!` — each said
 * plainly in the cell rather than resolved to a zero that looks like an
 * answer. This is the same rule the rest of the app runs on: a blank is
 * honest, a plausible number is not, and a spreadsheet is the format where an
 * invented figure travels furthest, because nobody re-checks the total.
 *
 * Floating point is floating point. `0.1 + 0.2` is what IEEE-754 says it is,
 * and the display rounds at twelve significant figures so the cell reads
 * `0.3` — the same thing Excel does, and for the same reason.
 */

import type { CourseId } from './types';

/** One sheet, as the store holds it. */
export interface Sheet {
  id: string;
  title: string;
  /** A course to file it under, or nothing. */
  courseId: CourseId | null;
  /** What has actually been typed, by A1 reference. */
  cells: Record<string, string>;
  /** How far the grid has been dragged out. Never smaller than what is in it. */
  rows: number;
  cols: number;
  created: number;
  updated: number;
}

/** The size a new sheet opens at: enough to look like a sheet, small enough to read. */
export const NEW_ROWS = 12;
export const NEW_COLS = 6;

/** As far as the grid may be dragged. A phone is not a data warehouse. */
export const MAX_ROWS = 200;
export const MAX_COLS = 26;

/** The five ways a cell can be wrong, said rather than swallowed. */
export const ERRORS = ['#DIV/0!', '#REF!', '#NAME?', '#VALUE!', '#CYCLE!'] as const;
export type Err = (typeof ERRORS)[number];

export type Value = number | string | boolean | Err;

export function isError(v: unknown): v is Err {
  return typeof v === 'string' && (ERRORS as readonly string[]).includes(v);
}

// ── Addresses ────────────────────────────────────────────────────────────

/** 0 → A, 25 → Z, 26 → AA. */
export function colName(index: number): string {
  let n = index;
  let out = '';
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  }
  return out;
}

/** A → 0, AA → 26. Case-insensitive, because nobody types capitals. */
export function colIndex(name: string): number {
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Row and column, both zero-based, as `B3`. */
export function ref(row: number, col: number): string {
  return `${colName(col)}${row + 1}`;
}

/**
 * The other direction, or nothing.
 *
 * `$B$3` parses to the same place as `B3`. The app has no reason to hold a
 * reference still — nothing here fills a formula down a column — but a sheet
 * pasted in from somewhere else carries dollar signs, and refusing to read
 * them would turn a working formula into `#NAME?` for no reason the person
 * could see.
 */
export function parseRef(text: string): { row: number; col: number } | null {
  const m = /^\$?([A-Za-z]{1,2})\$?(\d{1,4})$/.exec(text.trim());
  if (!m) return null;
  const col = colIndex(m[1]);
  const row = Number.parseInt(m[2], 10) - 1;
  if (row < 0 || col < 0) return null;
  return { row, col };
}

/** Every address in `A1:B3`, reading across then down. Empty if either end is nonsense. */
export function expand(from: string, to: string): string[] {
  const a = parseRef(from);
  const b = parseRef(to);
  if (!a || !b) return [];
  const out: string[] = [];
  for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r += 1) {
    for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c += 1) {
      out.push(ref(r, c));
    }
  }
  return out;
}

// ── Reading a cell ───────────────────────────────────────────────────────

export type Cells = Record<string, string>;

/**
 * A number if the text is one, otherwise nothing.
 *
 * Trailing `%` divides by a hundred and a leading currency symbol is dropped,
 * because a column typed as `$12.50` is a column of money and treating it as
 * text would make the total blank rather than wrong — which is worse here, as
 * the person would fix the total by typing it in by hand.
 */
export function asNumber(text: string): number | null {
  const t = text.trim().replace(/^[$£€]/, '').replace(/,/g, '');
  if (!t) return null;
  if (/%$/.test(t)) {
    const n = Number(t.slice(0, -1));
    return Number.isFinite(n) ? n / 100 : null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function isFormula(text: string): boolean {
  return text.trimStart().startsWith('=');
}

/**
 * What one cell comes to.
 *
 * `seen` is the path taken to get here, and it is the whole of the cycle
 * check: a cell already on the path is a cell that is asking for itself, and
 * without this the recursion is a stack overflow that takes the tab with it
 * rather than a `#CYCLE!` in one cell.
 */
export function evaluate(cells: Cells, address: string, seen: Set<string> = new Set()): Value {
  const key = address.toUpperCase();
  if (seen.has(key)) return '#CYCLE!';
  const raw = cells[key];
  if (raw === undefined || raw === '') return '';
  if (!isFormula(raw)) {
    const n = asNumber(raw);
    return n === null ? raw : n;
  }
  const next = new Set(seen);
  next.add(key);
  return run(raw.trimStart().slice(1), cells, next);
}

/**
 * What a cell shows.
 *
 * A formula shows its answer; anything else shows exactly what was typed.
 *
 * That second half is not an optimisation, it is the fix for a real loss:
 * `evaluate` reads `80%` as 0.8 so that a `SUM` over the column is right, and
 * a display that went through it too showed the person `0.8` in a cell they
 * had typed `80%` into. The same for `$12.50`, `1,200` and `007`. A sheet that
 * silently rewrites what you typed is a sheet you cannot trust to hold a
 * student number.
 */
export function display(cells: Cells, address: string): string {
  const raw = cells[address.toUpperCase()];
  if (raw !== undefined && raw !== '' && !isFormula(raw)) return raw;
  return show(evaluate(cells, address));
}

/**
 * A value as text.
 *
 * Twelve significant figures, then the trailing zeros taken off. Any fewer and
 * a genuine 1/3 loses precision somebody needs; any more and `0.1 + 0.2` shows
 * its floating-point tail, which reads as a bug in the app rather than as a
 * fact about binary fractions.
 */
export function show(value: Value): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '#VALUE!';
    return Number.parseFloat(value.toPrecision(12)).toString();
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return value;
}

// ── The formula engine ───────────────────────────────────────────────────

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'ref'; value: string }
  | { kind: 'name'; value: string }
  | { kind: 'op'; value: string };

const OPS = ['<>', '<=', '>=', '<', '>', '=', '+', '-', '*', '/', '^', '&', '(', ')', ',', ':', '%'];

function lex(text: string): Token[] | null {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '"') {
      const end = text.indexOf('"', i + 1);
      if (end < 0) return null;
      out.push({ kind: 'str', value: text.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const num = /^\d+(\.\d+)?|^\.\d+/.exec(text.slice(i));
    if (num) {
      out.push({ kind: 'num', value: Number(num[0]) });
      i += num[0].length;
      continue;
    }
    const word = /^\$?[A-Za-z][A-Za-z0-9_.]*\$?\d*/.exec(text.slice(i));
    if (word) {
      const w = word[0];
      out.push(parseRef(w) ? { kind: 'ref', value: w } : { kind: 'name', value: w.toUpperCase() });
      i += w.length;
      continue;
    }
    const op = OPS.find((o) => text.startsWith(o, i));
    if (!op) return null;
    out.push({ kind: 'op', value: op });
    i += op.length;
  }
  return out;
}

/**
 * A run of tokens, walked once.
 *
 * Recursive descent rather than a table: the grammar is six levels deep and
 * the readable version of it is six functions calling each other, which is
 * also the version somebody can add a level to without re-deriving anything.
 */
class Parser {
  private at = 0;

  private readonly tokens: Token[];
  private readonly cells: Cells;
  private readonly seen: Set<string>;

  constructor(tokens: Token[], cells: Cells, seen: Set<string>) {
    this.tokens = tokens;
    this.cells = cells;
    this.seen = seen;
  }

  private peek(): Token | undefined {
    return this.tokens[this.at];
  }

  private eat(value: string): boolean {
    const t = this.peek();
    if (t && t.kind === 'op' && t.value === value) {
      this.at += 1;
      return true;
    }
    return false;
  }

  /** Whether every token was consumed — an unconsumed tail is a typo, not a value. */
  done(): boolean {
    return this.at >= this.tokens.length;
  }

  /** Comparisons, which sit below arithmetic and produce a yes or a no. */
  expression(): Value {
    let left = this.concat();
    for (;;) {
      const t = this.peek();
      if (!t || t.kind !== 'op' || !['=', '<>', '<', '<=', '>', '>='].includes(t.value)) return left;
      this.at += 1;
      const right = this.concat();
      if (isError(left)) return left;
      if (isError(right)) return right;
      left = compare(t.value, left, right);
    }
  }

  private concat(): Value {
    let left = this.additive();
    while (this.eat('&')) {
      const right = this.additive();
      if (isError(left)) return left;
      if (isError(right)) return right;
      left = show(left) + show(right);
    }
    return left;
  }

  private additive(): Value {
    let left = this.multiplicative();
    for (;;) {
      const t = this.peek();
      if (!t || t.kind !== 'op' || (t.value !== '+' && t.value !== '-')) return left;
      this.at += 1;
      const right = this.multiplicative();
      const a = number(left);
      const b = number(right);
      if (isError(a)) return a;
      if (isError(b)) return b;
      left = t.value === '+' ? a + b : a - b;
    }
  }

  private multiplicative(): Value {
    let left = this.power();
    for (;;) {
      const t = this.peek();
      if (!t || t.kind !== 'op' || (t.value !== '*' && t.value !== '/')) return left;
      this.at += 1;
      const right = this.power();
      const a = number(left);
      const b = number(right);
      if (isError(a)) return a;
      if (isError(b)) return b;
      if (t.value === '/' && b === 0) return '#DIV/0!';
      left = t.value === '*' ? a * b : a / b;
    }
  }

  /** Right-associative, so `2^3^2` is 512 rather than 64 — as every sheet has it. */
  private power(): Value {
    const left = this.unary();
    if (!this.eat('^')) return left;
    const right = this.power();
    const a = number(left);
    const b = number(right);
    if (isError(a)) return a;
    if (isError(b)) return b;
    return a ** b;
  }

  private unary(): Value {
    if (this.eat('-')) {
      const v = number(this.unary());
      return isError(v) ? v : -v;
    }
    if (this.eat('+')) return this.unary();
    return this.postfix();
  }

  /** `50%` is a half. The only suffix operator a sheet has. */
  private postfix(): Value {
    let v = this.primary();
    while (this.eat('%')) {
      const n = number(v);
      if (isError(n)) return n;
      v = n / 100;
    }
    return v;
  }

  private primary(): Value {
    const t = this.peek();
    if (!t) return '#VALUE!';
    if (t.kind === 'num') {
      this.at += 1;
      return t.value;
    }
    if (t.kind === 'str') {
      this.at += 1;
      return t.value;
    }
    if (t.kind === 'ref') {
      this.at += 1;
      // A range outside a function — `A1:A3` on its own — has no single value,
      // so it is refused rather than silently taken as its first cell.
      if (this.eat(':')) {
        const end = this.peek();
        if (!end || end.kind !== 'ref') return '#REF!';
        this.at += 1;
        return '#VALUE!';
      }
      return evaluate(this.cells, t.value, this.seen);
    }
    if (t.kind === 'name') {
      this.at += 1;
      if (t.value === 'TRUE') return true;
      if (t.value === 'FALSE') return false;
      if (!this.eat('(')) return '#NAME?';
      const groups = this.arguments();
      if (isError(groups)) return groups;
      return apply(t.value, groups);
    }
    if (t.kind === 'op' && t.value === '(') {
      this.at += 1;
      const v = this.expression();
      return this.eat(')') ? v : '#VALUE!';
    }
    return '#VALUE!';
  }

  /**
   * The arguments to a function, one group per argument.
   *
   * `SUM(A1:A9, B1)` arrives as two groups — nine values and one — rather than
   * as ten. Almost every function flattens them immediately and does not care,
   * but `SUMPRODUCT` multiplies the first range by the second and cannot be
   * written at all against a flat list. Keeping the shape costs one `.flat()`
   * in the common case and is the difference between a weighted gradebook
   * working and not.
   */
  private arguments(): Value[][] | Err {
    const out: Value[][] = [];
    if (this.eat(')')) return out;
    for (;;) {
      const t = this.peek();
      const after = this.tokens[this.at + 1];
      if (t && t.kind === 'ref' && after && after.kind === 'op' && after.value === ':') {
        const end = this.tokens[this.at + 2];
        if (!end || end.kind !== 'ref') return '#REF!';
        this.at += 3;
        const range = expand(t.value, end.value);
        if (range.length === 0) return '#REF!';
        out.push(range.map((address) => evaluate(this.cells, address, this.seen)));
      } else {
        out.push([this.expression()]);
      }
      if (this.eat(',')) continue;
      return this.eat(')') ? out : '#VALUE!';
    }
  }
}

function run(body: string, cells: Cells, seen: Set<string>): Value {
  const tokens = lex(body);
  if (!tokens || tokens.length === 0) return '#VALUE!';
  const parser = new Parser(tokens, cells, seen);
  const value = parser.expression();
  // A tail nobody consumed means the formula was not understood, and a partial
  // answer to a formula is the most dangerous thing this file could return.
  if (!parser.done() && !isError(value)) return '#VALUE!';
  return value;
}

/** A value as a number, or the error that stops the sum. Blank is zero, as in every sheet. */
function number(v: Value): number | Err {
  if (isError(v)) return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v.trim() === '') return 0;
  const n = asNumber(v);
  return n === null ? '#VALUE!' : n;
}

function compare(op: string, a: Value, b: Value): Value {
  const bothNumeric = typeof a === 'number' && typeof b === 'number';
  const left = bothNumeric ? (a as number) : show(a).toLowerCase();
  const right = bothNumeric ? (b as number) : show(b).toLowerCase();
  switch (op) {
    case '=':
      return left === right;
    case '<>':
      return left !== right;
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    default:
      return left >= right;
  }
}

/** The numbers among a set of arguments. Text and blanks are skipped, as `SUM` skips them. */
function numbers(args: Value[]): number[] | Err {
  const out: number[] = [];
  for (const a of args) {
    if (isError(a)) return a;
    if (typeof a === 'number') out.push(a);
    else if (typeof a === 'boolean') out.push(a ? 1 : 0);
    else if (a.trim() !== '') {
      const n = asNumber(a);
      if (n !== null) out.push(n);
    }
  }
  return out;
}

const sum = (xs: number[]) => xs.reduce((t, x) => t + x, 0);
const mean = (xs: number[]) => sum(xs) / xs.length;

/** The sum of squared deviations — the shared middle of variance and both deviations. */
function squares(xs: number[]): number {
  const m = mean(xs);
  return sum(xs.map((x) => (x - m) ** 2));
}

/**
 * The functions a student's sheet actually needs.
 *
 * Chosen from what the four courses ask for rather than from what a
 * spreadsheet usually ships: a gradebook wants `SUM`, `AVERAGE` and a
 * weighted `SUMPRODUCT`; a statistics problem set wants `STDEV`, `VAR` and
 * `MEDIAN`; a budget wants `IF` and `ROUND`. Anything not here is `#NAME?`
 * rather than an approximation of it.
 */
function apply(name: string, groups: Value[][]): Value {
  const args = groups.flat();
  const first = args[0];
  const one = (f: (x: number) => number): Value => {
    const n = number(first ?? '');
    return isError(n) ? n : f(n);
  };

  switch (name) {
    case 'IF': {
      const test = groups[0]?.[0];
      if (test === undefined) return '#VALUE!';
      if (isError(test)) return test;
      const yes = typeof test === 'boolean' ? test : number(test) !== 0;
      const branch = yes ? groups[1]?.[0] : groups[2]?.[0];
      return branch === undefined ? yes : branch;
    }
    /*
     * The weighted average, which is the whole reason arguments keep their
     * shape. Ranges of different lengths are refused rather than padded with
     * zeros: a gradebook whose weights column is one row short is a mistake
     * worth stopping, and padding turns it into a total that is quietly low.
     */
    case 'SUMPRODUCT': {
      if (groups.length === 0) return 0;
      const lengths = new Set(groups.map((g) => g.length));
      if (lengths.size > 1) return '#VALUE!';
      let total = 0;
      for (let i = 0; i < groups[0].length; i += 1) {
        let product = 1;
        for (const group of groups) {
          const n = number(group[i]);
          if (isError(n)) return n;
          product *= n;
        }
        total += product;
      }
      return total;
    }
    case 'AND':
    case 'OR': {
      const flags: boolean[] = [];
      for (const a of args) {
        if (isError(a)) return a;
        flags.push(typeof a === 'boolean' ? a : number(a) !== 0);
      }
      return name === 'AND' ? flags.every(Boolean) : flags.some(Boolean);
    }
    case 'NOT': {
      if (isError(first)) return first;
      return !(typeof first === 'boolean' ? first : number(first ?? '') !== 0);
    }
    case 'COUNTA':
      return args.filter((a) => !(typeof a === 'string' && a.trim() === '')).length;
    case 'CONCAT': {
      let out = '';
      for (const a of args) {
        if (isError(a)) return a;
        out += show(a);
      }
      return out;
    }
    case 'LEN':
      return show(first ?? '').length;
    case 'UPPER':
      return show(first ?? '').toUpperCase();
    case 'LOWER':
      return show(first ?? '').toLowerCase();
    case 'TRIM':
      return show(first ?? '').trim();
    default:
      break;
  }

  const xs = numbers(args);
  if (isError(xs)) return xs;

  switch (name) {
    case 'SUM':
      return sum(xs);
    case 'PRODUCT':
      return xs.reduce((t, x) => t * x, 1);
    case 'COUNT':
      return xs.length;
    case 'AVERAGE':
    case 'AVG':
      return xs.length ? mean(xs) : '#DIV/0!';
    case 'MEDIAN': {
      if (!xs.length) return '#DIV/0!';
      const s = [...xs].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
    }
    case 'MIN':
      return xs.length ? Math.min(...xs) : 0;
    case 'MAX':
      return xs.length ? Math.max(...xs) : 0;
    // The sample forms divide by n − 1, which is what a statistics course
    // means by "the standard deviation" unless it says otherwise.
    case 'STDEV':
      return xs.length > 1 ? Math.sqrt(squares(xs) / (xs.length - 1)) : '#DIV/0!';
    case 'STDEVP':
      return xs.length ? Math.sqrt(squares(xs) / xs.length) : '#DIV/0!';
    case 'VAR':
      return xs.length > 1 ? squares(xs) / (xs.length - 1) : '#DIV/0!';
    case 'VARP':
      return xs.length ? squares(xs) / xs.length : '#DIV/0!';
    case 'ABS':
      return one(Math.abs);
    case 'INT':
      return one(Math.floor);
    case 'SQRT': {
      const n = number(first ?? '');
      if (isError(n)) return n;
      return n < 0 ? '#VALUE!' : Math.sqrt(n);
    }
    case 'EXP':
      return one(Math.exp);
    case 'LN': {
      const n = number(first ?? '');
      if (isError(n)) return n;
      return n <= 0 ? '#VALUE!' : Math.log(n);
    }
    case 'LOG10': {
      const n = number(first ?? '');
      if (isError(n)) return n;
      return n <= 0 ? '#VALUE!' : Math.log10(n);
    }
    case 'POWER':
      return (xs[0] ?? 0) ** (xs[1] ?? 0);
    case 'MOD':
      return xs[1] === 0 ? '#DIV/0!' : (xs[0] ?? 0) % xs[1];
    case 'ROUND': {
      const places = xs[1] ?? 0;
      const factor = 10 ** places;
      return Math.round((xs[0] ?? 0) * factor) / factor;
    }
    default:
      return '#NAME?';
  }
}

/**
 * A weighted average, as the formula rather than as the answer.
 *
 * The screen offers this as a button because it is the sum a gradebook is:
 * scores against weights, divided by the weights so it still reads right when
 * they are percentages that do not add to one. Returned as text so it lands in
 * the cell as a formula somebody can see and edit, not as a number with no
 * working behind it.
 */
export function weighted(scores: string, weights: string): string {
  return `=SUMPRODUCT(${scores},${weights})/SUM(${weights})`;
}

// ── The sheet as a whole ─────────────────────────────────────────────────

/** Every cell's displayed value, as a grid of strings the size of the sheet. */
export function grid(sheet: Sheet): string[][] {
  const out: string[][] = [];
  for (let r = 0; r < sheet.rows; r += 1) {
    const row: string[] = [];
    for (let c = 0; c < sheet.cols; c += 1) row.push(display(sheet.cells, ref(r, c)));
    out.push(row);
  }
  return out;
}

/** The same, trimmed to what is actually filled — what an export should carry. */
export function filled(sheet: Sheet): string[][] {
  const rows = grid(sheet);
  let lastRow = -1;
  let lastCol = -1;
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell !== '') {
        lastRow = Math.max(lastRow, r);
        lastCol = Math.max(lastCol, c);
      }
    });
  });
  if (lastRow < 0) return [];
  return rows.slice(0, lastRow + 1).map((row) => row.slice(0, lastCol + 1));
}

/** How wide the sheet actually is, for a caller that needs the number rather than the rows. */
export function extent(sheet: Sheet): { rows: number; cols: number } {
  const body = filled(sheet);
  return { rows: body.length, cols: body[0]?.length ?? 0 };
}

export function blankSheet(title: string, courseId: CourseId | null = null): Omit<Sheet, 'id'> {
  return {
    title: title.trim() || 'Untitled sheet',
    courseId,
    cells: {},
    rows: NEW_ROWS,
    cols: NEW_COLS,
    created: Date.now(),
    updated: Date.now(),
  };
}

/** A sheet built from rows of text — what a paste, an import or a tool call produces. */
export function fromRows(
  title: string,
  rows: string[][],
  courseId: CourseId | null = null,
): Omit<Sheet, 'id'> {
  const cells: Cells = {};
  rows.forEach((row, r) => {
    row.forEach((value, c) => {
      const text = value?.trim() ?? '';
      if (text) cells[ref(r, c)] = text;
    });
  });
  const wide = rows.reduce((n, row) => Math.max(n, row.length), 0);
  return {
    ...blankSheet(title, courseId),
    cells,
    rows: Math.min(MAX_ROWS, Math.max(NEW_ROWS, rows.length + 2)),
    cols: Math.min(MAX_COLS, Math.max(NEW_COLS, wide)),
  };
}

// ── Reading a table somebody pasted ──────────────────────────────────────

/** One CSV line, honouring quotes. Shared by the CSV and the auto-detect paths. */
function csvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cell);
      cell = '';
    } else cell += ch;
  }
  out.push(cell);
  return out;
}

/**
 * Rows out of whatever was pasted.
 *
 * Three shapes, in the order they turn up: a copy out of a spreadsheet, which
 * is tab-separated; a markdown table, which is what a model writes and what
 * half this app's own output is; and a CSV, which is what a download is.
 *
 * The separator is decided over the whole text rather than per line, because a
 * single line with a comma in one cell and tabs everywhere else is still a
 * tab-separated file — deciding per line would split that one row differently
 * from all the others, and a table with one wrong row is harder to spot than
 * one that is wrong throughout.
 */
export function readTable(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];

  const markdown = lines.filter((l) => /^\s*\|/.test(l)).length >= lines.length - 1;
  if (markdown && lines.length > 1) {
    return lines
      // The `|---|---|` rule under a markdown header is punctuation, not data.
      .filter((l) => !/^\s*\|[\s:|-]*\|\s*$/.test(l))
      .map((l) =>
        l
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim()),
      );
  }

  const tabs = lines.filter((l) => l.includes('\t')).length;
  const sep = tabs >= lines.length / 2 ? '\t' : ',';
  return lines.map((l) => csvLine(l, sep).map((c) => c.trim()));
}

/** Rows as a markdown table — how a sheet reaches a document, a note or a chat. */
export function toMarkdown(rows: string[][]): string {
  if (rows.length === 0) return '';
  const width = rows.reduce((n, r) => Math.max(n, r.length), 0);
  const pad = (row: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => (row[i] ?? '').replace(/\|/g, '\\|')).join(' | ')} |`;
  const rule = `| ${Array.from({ length: width }, () => '---').join(' | ')} |`;
  return [pad(rows[0]), rule, ...rows.slice(1).map(pad)].join('\n');
}

/** Rows as CSV, with the quoting `export.ts` uses and the CRLF Excel expects. */
export function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => (/[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
        .join(','),
    )
    .join('\r\n');
}

/**
 * A cell typed as a percentage, and the number behind it.
 *
 * `80%` is 0.8 to the arithmetic and "80%" on screen, and a writer that has to
 * put it in a file needs both — the number so it can be summed, and the fact
 * that it was a percentage so it can be shown as one. Without this a
 * gradebook's weights column reaches Excel as a column of 0.3s.
 */
export function asPercent(text: string): { value: number; decimals: number } | null {
  const t = text.trim().replace(/^[$£€]/, '').replace(/,/g, '');
  if (!/%$/.test(t)) return null;
  const body = t.slice(0, -1);
  const n = Number(body);
  if (!Number.isFinite(n)) return null;
  return { value: n / 100, decimals: (body.split('.')[1] ?? '').length };
}

/**
 * Which columns hold numbers, for a writer that has to decide a cell's type.
 *
 * A column counts as numeric when every filled cell below the header reads as
 * a number and at least one does. "At least one" is what keeps an empty
 * column out: an empty column satisfies "every cell is a number" vacuously,
 * and would be written to Excel as numeric, right-aligned and blank.
 */
export function numericColumns(rows: string[][], headerRow = true): boolean[] {
  const width = rows.reduce((n, r) => Math.max(n, r.length), 0);
  const body = headerRow ? rows.slice(1) : rows;
  return Array.from({ length: width }, (_, c) => {
    let any = false;
    for (const row of body) {
      const cell = (row[c] ?? '').trim();
      if (cell === '') continue;
      if (asNumber(cell) === null) return false;
      any = true;
    }
    return any;
  });
}
