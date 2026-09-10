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

/**
 * The six ways a cell can be wrong, said rather than swallowed.
 *
 * `#N/A` is the newest and the one that earns its place loudest: it is what a
 * lookup answers when the thing looked up is not there. Every other candidate
 * for that answer — a blank, a zero, the nearest row — is a number a student
 * would hand in, and `VLOOKUP` finding nothing is exactly the moment this file
 * must refuse to be helpful.
 */
export const ERRORS = ['#DIV/0!', '#REF!', '#NAME?', '#VALUE!', '#CYCLE!', '#N/A'] as const;
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

/**
 * How many rows and columns a range covers.
 *
 * `expand` flattens `A1:C4` to twelve addresses reading across then down, and
 * for `SUM` that is the whole story. A lookup is the other case: `VLOOKUP`
 * needs to know that those twelve are three wide before it can take the second
 * column of them, and it cannot recover that from a flat list. So the shape is
 * carried alongside the values rather than guessed at from their number —
 * twelve values could be 3×4, 4×3, 2×6 or 12×1, and guessing wrong returns a
 * confident answer from the wrong column.
 */
export function span(from: string, to: string): { rows: number; cols: number } {
  const a = parseRef(from);
  const b = parseRef(to);
  if (!a || !b) return { rows: 0, cols: 0 };
  return {
    rows: Math.abs(a.row - b.row) + 1,
    cols: Math.abs(a.col - b.col) + 1,
  };
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
 * What a formula needs from outside itself.
 *
 * Only the clock, and only because `TODAY()` and `NOW()` exist. Everything
 * else here is a sheet in and a value out, and the note at the top of this
 * file promises exactly that: *"no DOM and no clock. That split is what lets
 * the formula engine be tested properly."*
 *
 * Two dates a student needs — how long until the exam, what the last day of
 * the month is — cannot be computed without knowing today, so the choice was
 * to break the promise or to pass the clock in. Passing it in keeps the engine
 * pure: a test hands it a fixed instant and `=TODAY()` is the same value on
 * every machine on every day, which is the only way a date function is worth
 * having. The default reads the real clock once, at the top of a render, so a
 * sheet whose formulas span midnight still agrees with itself.
 */
export interface Ctx {
  /** Milliseconds since the Unix epoch — the instant this sheet is read at. */
  now: number;
}

/** A context around one instant. Called once per render, not once per cell. */
export function clock(now: number = Date.now()): Ctx {
  return { now };
}

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
/**
 * One address, written the one way the cell map is keyed.
 *
 * `$A$1`, `$A1`, `A$1` and `a1` are four spellings of one cell, and until this
 * existed only the last of them found it: `evaluate` upper-cased the string and
 * looked it up, so `cells['$A$1']` was `undefined` and a formula reading a
 * pinned reference came back blank — `=$A$1*2` was 0 where the cell held 5.
 *
 * Silently, which is what makes it the worst kind of fault this file can have.
 * The note at the top promises an error is *said* in the cell rather than
 * resolved to a zero that looks like an answer, and this was the app breaking
 * that promise: not a `#REF!` anybody would chase, a number.
 *
 * It only ever showed up on a sheet written somewhere else, because nothing in
 * this app produces a dollar sign — `parseRef` has always accepted them for
 * exactly that reason, and `expand` rebuilt range ends through `ref` so
 * `SUM($A$1:$B$2)` was right all along. A lone reference had no such rebuild.
 */
function key(address: string): string {
  const where = parseRef(address);
  return where ? ref(where.row, where.col) : address.toUpperCase();
}

export function evaluate(
  cells: Cells,
  address: string,
  seen: Set<string> = new Set(),
  ctx: Ctx = clock(),
): Value {
  const key_ = key(address);
  if (seen.has(key_)) return '#CYCLE!';
  const raw = cells[key_];
  if (raw === undefined || raw === '') return '';
  if (!isFormula(raw)) {
    const n = asNumber(raw);
    return n === null ? raw : n;
  }
  const next = new Set(seen);
  next.add(key_);
  return run(raw.trimStart().slice(1), cells, next, ctx);
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
export function display(cells: Cells, address: string, ctx: Ctx = clock()): string {
  const raw = cells[key(address)];
  if (raw !== undefined && raw !== '' && !isFormula(raw)) return raw;
  return show(evaluate(cells, address, new Set(), ctx));
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

/**
 * One argument to a function, with its shape kept.
 *
 * `SUM(A1:A9, B1)` arrives as two of these — nine values shaped 9×1, and one
 * shaped 1×1 — rather than as ten loose values. Almost every function flattens
 * them immediately and does not care. Three kinds do: `SUMPRODUCT` multiplies
 * the first range by the second and cannot be written against a flat list at
 * all; the lookups need the width to know which column they were asked for;
 * and the `*IF` pair walks a range beside another of the same length.
 */
export interface Group {
  values: Value[];
  rows: number;
  cols: number;
}

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
  private readonly ctx: Ctx;

  constructor(tokens: Token[], cells: Cells, seen: Set<string>, ctx: Ctx) {
    this.tokens = tokens;
    this.cells = cells;
    this.seen = seen;
    this.ctx = ctx;
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

  /*
   * ## An error is carried, never returned from the middle
   *
   * Every loop below keeps going after something goes wrong, with the error as
   * the running value, rather than returning it where it happened. That reads
   * like a detail and is the difference between two answers.
   *
   * Returning from the middle leaves the rest of the expression unread, and an
   * unread tail is what `run` calls a formula it only half understood — so
   * `=1/0*100` came back `#DIV/0!` on its own, where the *same* expression
   * inside a function came back `#VALUE!`: `arguments` found `*` where it
   * wanted a comma. Measured on the grade calculator, which is where this was
   * found: `=IF(B10=0,"",B11/B10*100)` answered `#VALUE!` in a cell whose
   * condition was true and whose taken branch was a blank string. The engine
   * evaluates every argument before it chooses one, so the arithmetic in the
   * branch nobody takes still has to parse.
   *
   * Carrying it costs nothing — an error put through `number` comes back the
   * same error — and it means the position of a fault no longer changes what
   * the cell says.
   */
  expression(): Value {
    let left = this.concat();
    for (;;) {
      const t = this.peek();
      if (!t || t.kind !== 'op' || !['=', '<>', '<', '<=', '>', '>='].includes(t.value)) return left;
      this.at += 1;
      const right = this.concat();
      if (isError(left)) continue;
      left = isError(right) ? right : compare(t.value, left, right);
    }
  }

  private concat(): Value {
    let left = this.additive();
    while (this.eat('&')) {
      const right = this.additive();
      if (isError(left)) continue;
      left = isError(right) ? right : show(left) + show(right);
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
      if (isError(a)) left = a;
      else if (isError(b)) left = b;
      else left = t.value === '+' ? a + b : a - b;
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
      if (isError(a)) left = a;
      else if (isError(b)) left = b;
      else if (t.value === '/' && b === 0) left = '#DIV/0!';
      else left = t.value === '*' ? a * b : a / b;
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
      v = isError(n) ? n : n / 100;
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
      return evaluate(this.cells, t.value, this.seen, this.ctx);
    }
    if (t.kind === 'name') {
      this.at += 1;
      if (t.value === 'TRUE') return true;
      if (t.value === 'FALSE') return false;
      if (!this.eat('(')) return '#NAME?';
      const groups = this.arguments();
      if (isError(groups)) return groups;
      return apply(t.value, groups, this.ctx);
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
  private arguments(): Group[] | Err {
    const out: Group[] = [];
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
        const shape = span(t.value, end.value);
        out.push({
          values: range.map((address) => evaluate(this.cells, address, this.seen, this.ctx)),
          rows: shape.rows,
          cols: shape.cols,
        });
      } else {
        out.push({ values: [this.expression()], rows: 1, cols: 1 });
      }
      if (this.eat(',')) continue;
      return this.eat(')') ? out : '#VALUE!';
    }
  }
}

function run(body: string, cells: Cells, seen: Set<string>, ctx: Ctx): Value {
  const tokens = lex(body);
  if (!tokens || tokens.length === 0) return '#VALUE!';
  const parser = new Parser(tokens, cells, seen, ctx);
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

// ── Criteria, dates and money ────────────────────────────────────────────

/**
 * A criterion, as the test it stands for.
 *
 * `COUNTIF(B2:B9, ">=90")` passes a string that is not a value but a question
 * about one, and the whole family — `COUNTIF`, `SUMIF`, `AVERAGEIF` and the
 * plural forms — turns on reading it the way every other sheet does:
 *
 * · a bare number or word is an equality test, case-insensitively;
 * · a leading `>=`, `<=`, `<>`, `>`, `<` or `=` is that comparison;
 * · `*` and `?` in a text test are wildcards, any-run and any-one.
 *
 * A comparison against something that is not a number falls back to comparing
 * the text, which is what makes `">=B"` work on a column of letter grades.
 */
export function matcher(criterion: Value): (v: Value) => boolean {
  const raw = typeof criterion === 'string' ? criterion.trim() : show(criterion);
  const m = /^(<=|>=|<>|=|<|>)(.*)$/.exec(raw);
  const op = m ? m[1] : '=';
  const rest = m ? m[2].trim() : raw;
  const wanted = asNumber(rest);

  /*
   * A blank cell matches nothing, unless nothing is what was asked for.
   *
   * This is the rule that makes a half-finished gradebook add up. `number`
   * reads a blank as zero — right for `SUM`, where a blank column is a zero
   * total — and reading it as zero here would make `SUMIF(C:C,">=0",B:B)`
   * count every ungraded row as scoring nothing. Measured, that turned "70% of
   * the course has been graded" into 100%, and "what do I need on the final"
   * into a division by a weight of zero.
   *
   * Excel draws the line in the same place and for the same reason: a blank is
   * the absence of an answer, not the answer zero.
   */
  const empty = (v: Value) => typeof v === 'string' && v.trim() === '';
  if (raw === '') return empty;

  if (op === '=' || op === '<>') {
    const yes = wildcard(rest);
    return (v) => {
      if (empty(v)) return false;
      const hit = wanted !== null && typeof v !== 'string' ? number(v) === wanted : yes(show(v));
      return op === '=' ? hit : !hit;
    };
  }

  return (v) => {
    if (empty(v)) return false;
    const n = wanted === null ? null : number(v);
    if (wanted !== null && !isError(n) && n !== null) {
      return compare(op, n, wanted) === true;
    }
    return compare(op, show(v), rest) === true;
  };
}

/** `*` for any run and `?` for any one character, anchored and case-blind. */
function wildcard(pattern: string): (text: string) => boolean {
  if (!/[*?]/.test(pattern)) {
    const want = pattern.toLowerCase();
    return (text) => text.trim().toLowerCase() === want;
  }
  const source = pattern
    .split(/([*?])/)
    .map((part) => (part === '*' ? '.*' : part === '?' ? '.' : escapeRe(part)))
    .join('');
  const re = new RegExp(`^${source}$`, 'i');
  return (text) => re.test(text.trim());
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every `*IFS` function is the same walk, so it is written once.
 *
 * Pairs of (range, criterion) after the first argument, all of which must hold
 * for a row to count. Ranges of different lengths are refused rather than
 * padded — the same rule `SUMPRODUCT` follows, and for the same reason: a
 * criteria range one row short is a mistake worth stopping, not a total
 * quietly computed over part of the data.
 */
function hits(pairs: Group[], length: number): number[] | Err {
  const chosen: number[] = [];
  for (let i = 0; i < pairs.length; i += 2) {
    if (!pairs[i + 1]) return '#VALUE!';
    if (pairs[i].values.length !== length) return '#VALUE!';
  }
  for (let row = 0; row < length; row += 1) {
    let all = true;
    for (let i = 0; i < pairs.length && all; i += 2) {
      const value = pairs[i].values[row];
      if (isError(value)) return value;
      all = matcher(pairs[i + 1].values[0] ?? '')(value);
    }
    if (all) chosen.push(row);
  }
  return chosen;
}

/**
 * Dates as serial numbers, counted from 1899-12-30 — the epoch every
 * spreadsheet uses, chosen so that a file written here opens in Excel with the
 * same dates in it rather than with dates two days out.
 *
 * The arithmetic is in UTC throughout. A date is a calendar day, not an
 * instant, and doing the sums in local time means a sheet built the evening
 * the clocks change is a day wrong — which is the one bug a date function
 * cannot be allowed to have. `TODAY` reads the local calendar day, once, and
 * converts it; everything after that is UTC.
 */
const EPOCH = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

export function toSerial(utcMs: number): number {
  return (utcMs - EPOCH) / DAY_MS;
}

export function fromSerial(serial: number): Date {
  return new Date(EPOCH + Math.round(serial * DAY_MS));
}

/** Today where the person is, as a serial. The whole of the local-time story. */
function today(ctx: Ctx): number {
  const local = new Date(ctx.now);
  return toSerial(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

/**
 * The present instant as a serial, fraction and all.
 *
 * The offset is the device's, so `NOW()` reads as the wall clock rather than
 * as UTC — which is what somebody timing a revision session means by it.
 */
function rightNow(ctx: Ctx): number {
  const local = new Date(ctx.now);
  return toSerial(ctx.now - local.getTimezoneOffset() * 60_000);
}

/**
 * A payment, by the annuity formula every finance course teaches.
 *
 * `type` is 0 for payments at the end of a period and 1 for the beginning.
 * A zero rate is not a division by zero here, it is a straight split — and
 * writing it as the limit rather than letting it divide is the difference
 * between an interest-free loan showing its instalment and showing `#DIV/0!`.
 */
function pmt(rate: number, nper: number, pv: number, fv: number, type: number): number | Err {
  if (nper === 0) return '#DIV/0!';
  if (rate === 0) return -(pv + fv) / nper;
  const growth = (1 + rate) ** nper;
  return (-(pv * growth + fv) * rate) / ((growth - 1) * (1 + rate * type));
}

function fvOf(rate: number, nper: number, pay: number, pv: number, type: number): number {
  if (rate === 0) return -(pv + pay * nper);
  const growth = (1 + rate) ** nper;
  return -(pv * growth + pay * (1 + rate * type) * ((growth - 1) / rate));
}

function pvOf(rate: number, nper: number, pay: number, fv: number, type: number): number | Err {
  if (rate === 0) return -(fv + pay * nper);
  const growth = (1 + rate) ** nper;
  return -(fv + pay * (1 + rate * type) * ((growth - 1) / rate)) / growth;
}

/**
 * A rate found by looking for it, because there is no closed form.
 *
 * Bisection rather than Newton: Newton is faster and, on the shapes a cash
 * flow actually takes, wanders off a root it started next to. This brackets
 * the answer and halves the bracket, which cannot diverge — and when no
 * bracket exists the honest answer is `#N/A` rather than the last guess.
 */
function solveRate(f: (r: number) => number, low = -0.999_999, high = 10): number | Err {
  let a = low;
  let b = high;
  let fa = f(a);
  let fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return '#N/A';
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa > 0 === fb > 0) return '#N/A';
  for (let i = 0; i < 200; i += 1) {
    const mid = (a + b) / 2;
    const fm = f(mid);
    if (!Number.isFinite(fm)) return '#N/A';
    if (Math.abs(fm) < 1e-10 || (b - a) / 2 < 1e-12) return mid;
    if (fm > 0 === fa > 0) {
      a = mid;
      fa = fm;
    } else {
      b = mid;
    }
  }
  return (a + b) / 2;
}

/** A value read as a yes or a no, the way `IF` reads its first argument. */
function truthy(v: Value | undefined): boolean {
  if (v === undefined || isError(v)) return false;
  if (typeof v === 'boolean') return v;
  const n = number(v);
  return !isError(n) && n !== 0;
}

/**
 * `TEXT(value, format)` — a number or a date under a picture of itself.
 *
 * A deliberately small set, and it refuses rather than approximates. The
 * formats read are the ones a student's sheet has in it:
 *
 * · dates — `yyyy`, `yy`, `mmmm`, `mmm`, `mm`, `m`, `dddd`, `ddd`, `dd`, `d`,
 *   and `hh`/`ss` with `mm` after an hour taken as minutes, as Excel does;
 * · numbers — `0` and `#` places, `,` for thousands, `%`, and a leading `$`,
 *   `£` or `€`.
 *
 * Anything else comes back as the value written plainly. That is the honest
 * failure: a format string this does not understand produces the number,
 * which is visibly unformatted, rather than a number silently shown under the
 * wrong picture — the failure somebody hands in.
 *
 * Until a cell can carry a format of its own, this is also how a date is read
 * at all: `TODAY()` is a count of days, and `=TEXT(TODAY(),"yyyy-mm-dd")` is
 * how it becomes a date on the screen.
 */
export function formatted(value: Value, format: string): Value {
  if (isError(value)) return value;
  if (!format.trim()) return show(value);
  const n = number(value);
  if (isError(n)) return show(value);

  if (/[ymdhs]/i.test(format) && !/[0#]/.test(format)) {
    const d = fromSerial(n);
    const pad = (x: number, width = 2) => String(x).padStart(width, '0');
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const frac = n - Math.floor(n);
    const secondsOfDay = Math.round(frac * 86_400);
    let afterHour = false;
    return format.replace(/yyyy|yy|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s/gi, (token) => {
      const t = token.toLowerCase();
      if (t === 'yyyy') return String(d.getUTCFullYear());
      if (t === 'yy') return pad(d.getUTCFullYear() % 100);
      if (t === 'hh' || t === 'h') {
        afterHour = true;
        const h = Math.floor(secondsOfDay / 3600);
        return t === 'hh' ? pad(h) : String(h);
      }
      if (t === 'ss' || t === 's') return pad(secondsOfDay % 60);
      if (t === 'mmmm') return MONTHS[d.getUTCMonth()];
      if (t === 'mmm') return MONTHS[d.getUTCMonth()].slice(0, 3);
      if (t === 'mm' || t === 'm') {
        // `mm` means minutes directly after an hour and months everywhere
        // else. It is Excel's rule, and without it "hh:mm" prints the month.
        if (afterHour) {
          afterHour = false;
          return pad(Math.floor(secondsOfDay / 60) % 60);
        }
        return t === 'mm' ? pad(d.getUTCMonth() + 1) : String(d.getUTCMonth() + 1);
      }
      if (t === 'dddd') return DAYS[d.getUTCDay()];
      if (t === 'ddd') return DAYS[d.getUTCDay()].slice(0, 3);
      return t === 'dd' ? pad(d.getUTCDate()) : String(d.getUTCDate());
    });
  }

  if (!/[0#]/.test(format)) return show(value);
  const percent = format.includes('%');
  const scaled = percent ? n * 100 : n;
  const money = /^[$£€]/.exec(format);
  const decimals = /\.([0#]+)/.exec(format);
  const places = decimals ? decimals[1].length : 0;
  const fixed = Math.abs(scaled).toFixed(places);
  const [whole, rest] = fixed.split('.');
  const grouped = format.includes(',') ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole;
  const sign = scaled < 0 ? '-' : '';
  return `${sign}${money ? money[0] : ''}${grouped}${rest ? `.${rest}` : ''}${percent ? '%' : ''}`;
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
function apply(name: string, groups: Group[], ctx: Ctx): Value {
  const args = groups.flatMap((g) => g.values);
  const first = args[0];
  const text = (i: number): string => show(args[i] ?? '');
  const one = (f: (x: number) => number): Value => {
    const n = number(first ?? '');
    return isError(n) ? n : f(n);
  };

  switch (name) {
    case 'IF': {
      const test = groups[0]?.values[0];
      if (test === undefined) return '#VALUE!';
      if (isError(test)) return test;
      const yes = typeof test === 'boolean' ? test : number(test) !== 0;
      const branch = yes ? groups[1]?.values[0] : groups[2]?.values[0];
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
      const lengths = new Set(groups.map((g) => g.values.length));
      if (lengths.size > 1) return '#VALUE!';
      let total = 0;
      for (let i = 0; i < groups[0].values.length; i += 1) {
        let product = 1;
        for (const group of groups) {
          const n = number(group.values[i]);
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
    /**
     * The chain of tests, which is what a grade boundary actually is.
     *
     * `IFS(A1>=90,"A",A1>=80,"B",TRUE,"C")` reads down the pairs and stops at
     * the first that holds. Nothing matching is `#N/A` rather than a blank:
     * a letter grade that silently came out empty is a row somebody scrolls
     * past.
     */
    case 'IFS': {
      for (let i = 0; i + 1 < groups.length; i += 2) {
        const test = groups[i].values[0];
        if (test === undefined) return '#VALUE!';
        if (isError(test)) return test;
        const yes = typeof test === 'boolean' ? test : number(test) !== 0;
        if (yes) return groups[i + 1].values[0] ?? '';
      }
      return '#N/A';
    }
    /**
     * The one place an error is allowed to be swallowed, because the person
     * asked for it by name. Everywhere else this file says what went wrong.
     */
    case 'IFERROR': {
      const value = groups[0]?.values[0];
      if (value === undefined) return '#VALUE!';
      return isError(value) ? (groups[1]?.values[0] ?? '') : value;
    }
    /*
     * The lookups.
     *
     * All four answer `#N/A` when the thing is not there, and none of them
     * approximates. Excel's fourth argument to `VLOOKUP` defaults to TRUE —
     * "close enough, assuming the column is sorted" — and that default is how
     * a lookup returns the wrong row to somebody who never knew there was a
     * fourth argument. Here it defaults to exact, and an approximate match
     * happens only when the sheet asks for one in writing.
     */
    case 'VLOOKUP':
    case 'HLOOKUP': {
      const table = groups[1];
      if (!table) return '#VALUE!';
      const wanted = groups[0]?.values[0];
      if (wanted === undefined) return '#VALUE!';
      if (isError(wanted)) return wanted;
      const index = number(groups[2]?.values[0] ?? '');
      if (isError(index)) return index;
      const down = name === 'VLOOKUP';
      const across = table.cols;
      const lines = down ? table.rows : table.cols;
      const depth = down ? table.cols : table.rows;
      if (index < 1 || index > depth) return '#REF!';
      const at = (line: number, step: number): Value =>
        down ? table.values[line * across + step] : table.values[step * across + line];
      const loose = groups[3] ? truthy(groups[3].values[0]) : false;
      const same = matcher(wanted);
      let best = -1;
      for (let line = 0; line < lines; line += 1) {
        const key = at(line, 0);
        if (isError(key)) return key;
        if (!loose && same(key)) {
          best = line;
          break;
        }
        if (loose && compare('<=', key, wanted) === true) best = line;
      }
      if (best < 0) return '#N/A';
      return at(best, index - 1) ?? '';
    }
    /**
     * `XLOOKUP(what, where, return, [if-missing])`.
     *
     * The modern one, and the one worth teaching: the lookup column and the
     * answer column are named separately, so inserting a column in between
     * cannot silently change what the formula returns — which is the standing
     * flaw in `VLOOKUP`'s index number.
     */
    case 'XLOOKUP': {
      const wanted = groups[0]?.values[0];
      const where = groups[1];
      const answers = groups[2];
      if (wanted === undefined || !where || !answers) return '#VALUE!';
      if (isError(wanted)) return wanted;
      if (where.values.length !== answers.values.length) return '#VALUE!';
      const same = matcher(wanted);
      for (let i = 0; i < where.values.length; i += 1) {
        const key = where.values[i];
        if (isError(key)) return key;
        if (same(key)) return answers.values[i] ?? '';
      }
      return groups[3] ? (groups[3].values[0] ?? '') : '#N/A';
    }
    /** `INDEX(range, row, [col])`, one-based, and out of range is `#REF!`. */
    case 'INDEX': {
      const table = groups[0];
      if (!table) return '#VALUE!';
      const row = number(groups[1]?.values[0] ?? 1);
      if (isError(row)) return row;
      const col = groups[2] ? number(groups[2].values[0]) : 1;
      if (isError(col)) return col;
      // A single row or column is indexed by one number, as every sheet has
      // it: INDEX(A1:A9, 3) is the third cell, not the third row of a column.
      if (table.rows === 1 || table.cols === 1) {
        if (!groups[2]) {
          const flat = table.values[row - 1];
          return row < 1 || flat === undefined ? '#REF!' : flat;
        }
      }
      if (row < 1 || row > table.rows || col < 1 || col > table.cols) return '#REF!';
      return table.values[(row - 1) * table.cols + (col - 1)] ?? '';
    }
    /** Where in a range something sits, one-based. `#N/A` when it is not there. */
    case 'MATCH': {
      const wanted = groups[0]?.values[0];
      const where = groups[1];
      if (wanted === undefined || !where) return '#VALUE!';
      if (isError(wanted)) return wanted;
      const same = matcher(wanted);
      for (let i = 0; i < where.values.length; i += 1) {
        if (same(where.values[i])) return i + 1;
      }
      return '#N/A';
    }
    // ── Text ──────────────────────────────────────────────────────────────
    case 'LEFT': {
      const n = groups[1] ? number(groups[1].values[0]) : 1;
      if (isError(n)) return n;
      return n < 0 ? '#VALUE!' : text(0).slice(0, n);
    }
    case 'RIGHT': {
      const n = groups[1] ? number(groups[1].values[0]) : 1;
      if (isError(n)) return n;
      if (n < 0) return '#VALUE!';
      return n === 0 ? '' : text(0).slice(-n);
    }
    case 'MID': {
      const start = number(groups[1]?.values[0] ?? '');
      const count = number(groups[2]?.values[0] ?? '');
      if (isError(start)) return start;
      if (isError(count)) return count;
      if (start < 1 || count < 0) return '#VALUE!';
      return text(0).slice(start - 1, start - 1 + count);
    }
    /**
     * `SPLIT(text, delimiter)` — the nth piece, or all of them joined by a
     * space when no piece is named.
     *
     * A grid has no way to spill one value across several cells, so the
     * alternative to a third argument would be quietly returning only the
     * first piece. Naming the piece is honest about what a single cell can
     * hold.
     */
    case 'SPLIT': {
      const parts = text(0).split(show(groups[1]?.values[0] ?? ' '));
      if (!groups[2]) return parts.join(' ');
      const n = number(groups[2].values[0]);
      if (isError(n)) return n;
      return parts[n - 1] ?? '#N/A';
    }
    /** A value under a format. See `formatted` for which formats are read. */
    case 'TEXT':
      return formatted(args[0] ?? '', show(groups[1]?.values[0] ?? ''));
    // ── Dates ─────────────────────────────────────────────────────────────
    case 'TODAY':
      return today(ctx);
    case 'NOW':
      return rightNow(ctx);
    case 'DATE': {
      const y = number(groups[0]?.values[0] ?? '');
      const m = number(groups[1]?.values[0] ?? '');
      const d = number(groups[2]?.values[0] ?? '');
      if (isError(y)) return y;
      if (isError(m)) return m;
      if (isError(d)) return d;
      return toSerial(Date.UTC(y, m - 1, d));
    }
    /**
     * `DATEDIF(from, to, unit)` — "Y", "M" or "D", and the one every planner
     * is built on: how long until the exam.
     *
     * Whole units, counting down. A start after the end is `#NUM!` in Excel;
     * there is no `#NUM!` here, and `#VALUE!` says the same thing — the
     * arguments are the wrong way round — without inventing a seventh error.
     */
    case 'DATEDIF': {
      const from = number(groups[0]?.values[0] ?? '');
      const to = number(groups[1]?.values[0] ?? '');
      if (isError(from)) return from;
      if (isError(to)) return to;
      if (to < from) return '#VALUE!';
      const unit = show(groups[2]?.values[0] ?? 'D').trim().toUpperCase();
      if (unit === 'D') return Math.floor(to) - Math.floor(from);
      const a = fromSerial(from);
      const b = fromSerial(to);
      let months =
        (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
      if (b.getUTCDate() < a.getUTCDate()) months -= 1;
      if (unit === 'M') return months;
      if (unit === 'Y') return Math.floor(months / 12);
      return '#VALUE!';
    }
    /** 1 for Sunday through 7 for Saturday, which is the default every sheet has. */
    case 'WEEKDAY': {
      const serial = number(groups[0]?.values[0] ?? '');
      if (isError(serial)) return serial;
      return fromSerial(serial).getUTCDay() + 1;
    }
    /** The last day of the month `n` months along — quarter ends, rent, term dates. */
    case 'EOMONTH': {
      const serial = number(groups[0]?.values[0] ?? '');
      const months = groups[1] ? number(groups[1].values[0]) : 0;
      if (isError(serial)) return serial;
      if (isError(months)) return months;
      const d = fromSerial(serial);
      return toSerial(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months + 1, 0));
    }
    // ── Counting and summing under a condition ────────────────────────────
    case 'COUNTIF':
    case 'SUMIF':
    case 'AVERAGEIF': {
      const where = groups[0];
      if (!where || !groups[1]) return '#VALUE!';
      const same = matcher(groups[1].values[0] ?? '');
      // SUMIF's third argument is the column actually added up, which is what
      // lets a gradebook count one column and total another.
      const totals = groups[2] ?? where;
      if (totals.values.length !== where.values.length) return '#VALUE!';
      const picked: Value[] = [];
      for (let i = 0; i < where.values.length; i += 1) {
        const v = where.values[i];
        if (isError(v)) return v;
        if (same(v)) picked.push(totals.values[i]);
      }
      if (name === 'COUNTIF') return picked.length;
      const ns = numbers(picked);
      if (isError(ns)) return ns;
      if (name === 'SUMIF') return sum(ns);
      return ns.length ? mean(ns) : '#DIV/0!';
    }
    case 'COUNTIFS':
    case 'SUMIFS': {
      // COUNTIFS is (range, criterion) pairs from the start; SUMIFS puts the
      // range being added up first and the pairs after it.
      const counting = name === 'COUNTIFS';
      const pairs = counting ? groups : groups.slice(1);
      if (pairs.length < 2) return '#VALUE!';
      const length = pairs[0].values.length;
      const rows = hits(pairs, length);
      if (isError(rows)) return rows;
      if (counting) return rows.length;
      const totals = groups[0];
      if (!totals || totals.values.length !== length) return '#VALUE!';
      const ns = numbers(rows.map((r) => totals.values[r]));
      return isError(ns) ? ns : sum(ns);
    }
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
    case 'MODE': {
      if (!xs.length) return '#N/A';
      const tally = new Map<number, number>();
      for (const x of xs) tally.set(x, (tally.get(x) ?? 0) + 1);
      let best = 0;
      let at = 0;
      for (const [value, count] of tally) {
        if (count > best) {
          best = count;
          at = value;
        }
      }
      // Nothing repeating has no mode. Excel says #N/A and it is right: the
      // first value of a column of distinct numbers is not the common one.
      return best > 1 ? at : '#N/A';
    }
    /** Pearson's r, over two ranges of the same length. */
    case 'CORREL': {
      const a = numbers(groups[0]?.values ?? []);
      const b = numbers(groups[1]?.values ?? []);
      if (isError(a)) return a;
      if (isError(b)) return b;
      if (a.length !== b.length || a.length < 2) return '#DIV/0!';
      const ma = mean(a);
      const mb = mean(b);
      let top = 0;
      for (let i = 0; i < a.length; i += 1) top += (a[i] - ma) * (b[i] - mb);
      const spread = Math.sqrt(squares(a) * squares(b));
      return spread === 0 ? '#DIV/0!' : top / spread;
    }
    // ── Money ─────────────────────────────────────────────────────────────
    /**
     * `NPV(rate, ...flows)` — discounted from period one, as Excel has it.
     *
     * The catch worth knowing, and the reason this comment exists: Excel's
     * `NPV` discounts the *first* flow by one period, so an investment made
     * today goes outside the function — `=A1+NPV(r,B1:E1)` — rather than
     * inside it. Matching Excel here matters more than being right in the
     * abstract, because the answer is checked against a classmate's sheet.
     */
    case 'NPV': {
      const rate = number(groups[0]?.values[0] ?? '');
      if (isError(rate)) return rate;
      if (rate === -1) return '#DIV/0!';
      const flows = numbers(groups.slice(1).flatMap((g) => g.values));
      if (isError(flows)) return flows;
      let total = 0;
      for (let i = 0; i < flows.length; i += 1) total += flows[i] / (1 + rate) ** (i + 1);
      return total;
    }
    /** The rate at which the flows come to nothing. `#N/A` when none does. */
    case 'IRR': {
      const flows = numbers(groups[0]?.values ?? []);
      if (isError(flows)) return flows;
      if (flows.length < 2) return '#VALUE!';
      return solveRate((r) =>
        flows.reduce((total, flow, i) => total + flow / (1 + r) ** i, 0),
      );
    }
    case 'PMT': {
      const [rate, nper, pv] = [xs[0] ?? 0, xs[1] ?? 0, xs[2] ?? 0];
      return pmt(rate, nper, pv, xs[3] ?? 0, xs[4] ?? 0);
    }
    case 'FV':
      return fvOf(xs[0] ?? 0, xs[1] ?? 0, xs[2] ?? 0, xs[3] ?? 0, xs[4] ?? 0);
    case 'PV':
      return pvOf(xs[0] ?? 0, xs[1] ?? 0, xs[2] ?? 0, xs[3] ?? 0, xs[4] ?? 0);
    case 'RATE': {
      const [nper, pay, pv, fv, type] = [xs[0] ?? 0, xs[1] ?? 0, xs[2] ?? 0, xs[3] ?? 0, xs[4] ?? 0];
      if (nper === 0) return '#DIV/0!';
      return solveRate((r) => fvOf(r, nper, pay, pv, type) - fv);
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
