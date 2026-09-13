/**
 * Arithmetic, for the notation the app already writes.
 *
 * `lib/maths.ts` reads a small piece of LaTeX and draws it three ways, and
 * said at the top that it would never compute: an equation renderer that
 * quietly simplified would be a second calculator nobody had tested. That was
 * the right rule and it left a hole in the middle of the app. A student in
 * econ and statistics wrote `E_d = \frac{\Delta Q}{\Delta P}` into the app,
 * read it back beautifully, and then opened a different application to put
 * numbers in it.
 *
 * So this is the calculator, and it is one calculator, tested. It reads the
 * same notation `lib/maths.ts` draws — the same `\frac`, the same `x^2`, the
 * same greek out of the same table — plus the plain `2*(1+r)^n` anybody types
 * without thinking about it. What `lib/maths.ts` draws, this works out, and
 * `lib/plot.ts` draws the curve of. Three readings of one notation rather than
 * three notations.
 *
 * ## What it is not
 *
 * It is not the spreadsheet. `lib/sheet.ts` evaluates `=SUM(B2:B9)` against a
 * grid of cells and always will: A1 references, ranges, lookups and dates are
 * that engine's whole subject and none of them mean anything here. This one
 * has no cells. It has variables — `r`, `x`, `P_2`, `σ` — and that difference
 * is the reason the two are separate rather than one engine wearing two hats.
 *
 * It does not rearrange. `x + 3 = 7` is a relation this can *test* at a value
 * of x and `lib/plot.ts` can draw; nothing here solves it for x. Symbolic
 * algebra is a different program, and one that half-solved would be worse than
 * none.
 *
 * ## The rules that are worth knowing
 *
 * **Letters written together are one name.** `PV` is a variable called PV, not
 * P times V, because the formulas this app ships — `PV`, `NPV`, `MOE`, `CS` —
 * are written that way and a student filling one in should not have to think
 * about it. A **space** is what multiplies: `a sin(x)` is a times sin of x,
 * and `2x` is too, since a digit cannot start a name.
 *
 * **Nothing is guessed.** An unknown name is reported by `free()` and reads as
 * blank rather than as zero, a `±` is refused rather than resolved to one of
 * its two answers, and `0/0` is `NaN` rather than a number that looks like an
 * answer. This is the same rule the rest of the app runs on: a blank is
 * honest, a plausible number is not.
 *
 * **It never throws.** Bad notation comes back as a fault with a sentence
 * somebody can act on. A calculator that throws takes the screen with it.
 */

import { SYMBOLS } from './maths';

/**
 * What a value is.
 *
 * A number, or a list of them. Lists are here because a statistics course is
 * about lists — `mean([4, 7, 9])`, a column of marks, the family of curves you
 * get by drawing one formula at ten values of a parameter — and because
 * arithmetic over a list is the same arithmetic: `2 * [1, 2, 3]` is
 * `[2, 4, 6]`, worked elementwise, so nothing else in this file has to know
 * whether it is holding one number or forty.
 */
export type Val = number | number[];

export type Node =
  | { kind: 'num'; value: number }
  | { kind: 'name'; name: string }
  | { kind: 'list'; items: Node[] }
  /** `[1, ..., 10]` and `[0, 0.5, ..., 4]` — a run, with its step implied. */
  | { kind: 'range'; from: Node; second: Node | null; to: Node }
  | { kind: 'neg'; body: Node }
  | { kind: 'op'; op: '+' | '-' | '*' | '/' | '^'; left: Node; right: Node }
  | { kind: 'call'; name: string; args: Node[] }
  /**
   * `f(2)` — which is a function where `f` is one and a multiplication where
   * it is not, and nothing at the time of reading knows which. Both readings
   * are ordinary: `f(x) = x^2` above makes the first, and `a(x + 1)` with a
   * slider called `a` makes the second. So the choice is left until there is a
   * scope to make it against — see `value`.
   */
  | { kind: 'apply'; name: string; args: Node[] }
  | { kind: 'fact'; body: Node }
  | { kind: 'percent'; body: Node }
  | { kind: 'abs'; body: Node }
  | { kind: 'big'; op: 'sum' | 'prod'; index: string; from: Node; to: Node; body: Node };

/** A function somebody defined — `f(x) = x^2 + 1`. */
export interface Fun {
  params: string[];
  body: Node;
}

export interface Scope {
  vars?: Record<string, Val>;
  funs?: Record<string, Fun>;
  /** Degrees rather than radians, for the trigonometric functions only. */
  degrees?: boolean;
}

export type Read = { ok: true; node: Node } | { ok: false; fault: string };

// ── Reading it ───────────────────────────────────────────────────────────

type Tok = {
  kind: 'num' | 'name' | 'op';
  value: string;
  /** Whether whitespace came before it. A space is what multiplies — see the note above. */
  spaced: boolean;
  at: number;
};

/** The operator characters a keyboard, a textbook and this app's own symbol table all produce. */
const SAME: Record<string, string> = {
  '×': '*',
  '·': '*',
  '∗': '*',
  '÷': '/',
  '−': '-',
  '–': '-',
  '—': '-',
  '⁄': '/',
  '**': '^',
};

/** What a command means here, where it is not a letter. Everything else comes from `SYMBOLS`. */
const COMMANDS: Record<string, string> = {
  cdot: '*',
  times: '*',
  div: '/',
  frac: '\\frac',
  dfrac: '\\frac',
  tfrac: '\\frac',
  left: '',
  right: '',
  ',': '',
  ';': '',
  ' ': '',
  '%': '%',
};

/** The commands that mean a word rather than a symbol: `\text{Nominal}` is a variable. */
const WORDS = new Set(['text', 'mathrm', 'operatorname']);

/**
 * The two symbols that belong to the letter after them.
 *
 * `\Delta Q` is written with a space because LaTeX needs one to know where the
 * command's name ends — the space is punctuation, not a gap — and what it
 * means is ΔQ, one quantity. Every other greek letter is a quantity in its own
 * right, so `\pi r^2` is π times r squared and must stay that way. Getting
 * this wrong is quiet: the person is asked to fill in Δ, Q and P separately
 * for a formula that has two terms in it.
 */
const GLUED = new Set(['Δ', '∂']);

function lex(source: string): Tok[] | string {
  const out: Tok[] = [];
  let i = 0;
  let spaced = false;
  const push = (kind: Tok['kind'], value: string, at: number) => {
    out.push({ kind, value, spaced, at });
    spaced = false;
  };

  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      spaced = true;
      i += 1;
      continue;
    }

    if (ch === '\\') {
      const m = /^\\(?:([A-Za-z]+)[ \t]*|(.))/.exec(source.slice(i));
      if (!m) return 'A backslash on its own is not notation this knows.';
      const name = m[1] ?? m[2];
      i += m[0].length;
      if (WORDS.has(name)) {
        // `\text{Price index}` is one variable called "Price index" — the
        // formulas this app ships name their terms that way.
        const group = /^\s*\{([^}]*)\}/.exec(source.slice(i));
        if (!group) return `\\${name} wants a {…} after it.`;
        i += group[0].length;
        push('name', group[1].trim(), i);
        continue;
      }
      const known = COMMANDS[name];
      if (known !== undefined) {
        if (known === '') {
          spaced = true;
          continue;
        }
        push('op', known, i);
        continue;
      }
      const symbol = SYMBOLS[name];
      if (symbol) {
        const op = SAME[symbol];
        if (op) push('op', op, i);
        else if (/[A-Za-zα-ωΑ-Ω∂]/.test(symbol)) push('name', symbol, i);
        else return `${symbol} is a symbol this cannot work out — it is notation, not arithmetic.`;
        continue;
      }
      // An unknown command reads as a name, so `\foo` is a variable somebody
      // can see is unset rather than an error about a backslash.
      push('name', name, i);
      continue;
    }

    const num = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(i));
    if (num) {
      push('num', num[0], i);
      i += num[0].length;
      continue;
    }

    // Letters run together are one name; Greek letters are letters. A space is
    // what separates two of them, which is the whole rule for `a sin(x)`.
    const word = /^[A-Za-zα-ωΑ-Ωθφ°]+/.exec(source.slice(i));
    if (word) {
      const prior = out[out.length - 1];
      if (prior && prior.kind === 'name' && GLUED.has(prior.value)) prior.value += word[0];
      else push('name', word[0], i);
      i += word[0].length;
      continue;
    }

    const two = source.slice(i, i + 2);
    if (SAME[two]) {
      push('op', SAME[two], i);
      i += 2;
      continue;
    }
    if (SAME[ch]) {
      push('op', SAME[ch], i);
      i += 1;
      continue;
    }
    if ('+-*/^()[]{},|!%_=<>'.includes(ch)) {
      push('op', ch, i);
      i += 1;
      continue;
    }
    if (ch === '.' && source.slice(i, i + 3) === '...') {
      push('op', '...', i);
      i += 3;
      continue;
    }
    return `“${ch}” is not something this can work out.`;
  }
  return out;
}

/** The two operators that take limits, and what an empty product and sum start from. */
const BIGS: Record<string, 'sum' | 'prod'> = { sum: 'sum', prod: 'prod', Sigma: 'sum', Pi: 'prod', '∑': 'sum', '∏': 'prod' };

class Parser {
  private at = 0;

  /**
   * How many pairs of bars we are inside.
   *
   * `|3 - 10|` read without this counter loses its own closing bar: the parser
   * finishes `3 - 10`, sees a `|`, and takes it for the start of a second
   * absolute value to multiply by. Inside a pair, a bar can only be the
   * closing one; outside, it may start a new one, which is what makes `2|x|`
   * and `|a||b|` read the way they look.
   */
  private bars = 0;

  private readonly toks: Tok[];

  constructor(toks: Tok[]) {
    this.toks = toks;
  }

  private peek(ahead = 0): Tok | undefined {
    return this.toks[this.at + ahead];
  }

  private take(): Tok | undefined {
    const t = this.toks[this.at];
    this.at += 1;
    return t;
  }

  private isOp(value: string, ahead = 0): boolean {
    const t = this.peek(ahead);
    return !!t && t.kind === 'op' && t.value === value;
  }

  private want(value: string, says: string): void {
    if (!this.isOp(value)) throw new Fault(says);
    this.at += 1;
  }

  done(): boolean {
    return this.at >= this.toks.length;
  }

  rest(): Tok | undefined {
    return this.peek();
  }

  /** `a + b`, the whole of it. */
  sum(): Node {
    let left = this.product();
    for (;;) {
      if (this.isOp('+')) {
        this.at += 1;
        left = { kind: 'op', op: '+', left, right: this.product() };
      } else if (this.isOp('-')) {
        this.at += 1;
        left = { kind: 'op', op: '-', left, right: this.product() };
      } else return left;
    }
  }

  /**
   * `a * b`, `a / b`, and the multiplication nobody writes.
   *
   * Implicit multiplication sits at exactly the precedence of the written kind
   * — `2x/3y` is `(2x)/3 * y`, the same as `2*x/3*y` — because one rule that
   * can be stated in a sentence beats a clever one that surprises somebody
   * once a term. What it will not do is glue a *name* to a name: `xy` is one
   * variable, and `x y` with the space is the product.
   */
  private product(): Node {
    let left = this.unary();
    for (;;) {
      if (this.isOp('*')) {
        this.at += 1;
        left = { kind: 'op', op: '*', left, right: this.unary() };
      } else if (this.isOp('/')) {
        this.at += 1;
        left = { kind: 'op', op: '/', left, right: this.unary() };
      } else if (this.starts()) {
        left = { kind: 'op', op: '*', left, right: this.unary() };
      } else return left;
    }
  }

  /**
   * Whether what comes next could begin a value, which is what implicit
   * multiplication needs.
   *
   * A `|` counts only outside a pair of bars — see `bars` above, which is what
   * stops `|3 - 10|` from reading its own closing bar as a second value to
   * multiply by.
   */
  private starts(): boolean {
    const t = this.peek();
    if (!t) return false;
    if (t.kind === 'num' || t.kind === 'name') return true;
    if (t.kind !== 'op') return false;
    if (t.value === '|') return this.bars === 0;
    return t.value === '(' || t.value === '{' || t.value === '[';
  }

  private unary(): Node {
    if (this.isOp('-')) {
      this.at += 1;
      return { kind: 'neg', body: this.unary() };
    }
    if (this.isOp('+')) {
      this.at += 1;
      return this.unary();
    }
    return this.power();
  }

  /** `a^b`, right-associative, and tighter than the minus in front of it. */
  private power(): Node {
    const base = this.postfix();
    if (this.isOp('^')) {
      this.at += 1;
      // The exponent may itself be signed — `10^-3` — and is read to the right.
      return { kind: 'op', op: '^', left: base, right: this.unary() };
    }
    return base;
  }

  private postfix(): Node {
    let body = this.primary();
    for (;;) {
      if (this.isOp('!')) {
        this.at += 1;
        body = { kind: 'fact', body };
      } else if (this.isOp('%')) {
        this.at += 1;
        body = { kind: 'percent', body };
      } else return body;
    }
  }

  private group(open: string, close: string, says: string): Node {
    this.want(open, says);
    const body = this.sum();
    this.want(close, `A ${open} with no ${close} after it.`);
    return body;
  }

  /** A `{…}` or a bare token — how LaTeX writes an argument. */
  private argument(): Node {
    if (this.isOp('{')) return this.group('{', '}', '');
    return this.postfix();
  }

  private primary(): Node {
    const t = this.take();
    if (!t) throw new Fault('It stops in the middle — something is missing from the end.');

    if (t.kind === 'num') return { kind: 'num', value: Number(t.value) };

    if (t.kind === 'op') {
      if (t.value === '(') {
        const body = this.sum();
        this.want(')', 'A ( with no ) after it.');
        return body;
      }
      if (t.value === '{') {
        const body = this.sum();
        this.want('}', 'A { with no } after it.');
        return body;
      }
      if (t.value === '|') {
        this.bars += 1;
        const body = this.sum();
        this.want('|', 'A | with no | after it.');
        this.bars -= 1;
        return { kind: 'abs', body };
      }
      if (t.value === '[') return this.list();
      if (t.value === '\\frac') {
        return { kind: 'op', op: '/', left: this.argument(), right: this.argument() };
      }
      if (t.value === '=' || t.value === '<' || t.value === '>') {
        throw new Fault('An = makes this a relation rather than a sum. Give the side you want worked out.');
      }
      throw new Fault(`“${t.value}” cannot start a value.`);
    }

    return this.named(t);
  }

  /** `[1, 2, 3]`, and `[1, ..., 10]` with the step implied by what comes first. */
  private list(): Node {
    const items: Node[] = [];
    let second: Node | null = null;
    if (this.isOp(']')) {
      this.at += 1;
      return { kind: 'list', items: [] };
    }
    for (;;) {
      if (this.isOp('...')) {
        this.at += 1;
        this.want(',', 'A … in a list wants the last value after it.');
        const to = this.sum();
        this.want(']', 'A [ with no ] after it.');
        const from = items[0];
        if (!from) throw new Fault('A … in a list wants a first value before it.');
        second = items[1] ?? null;
        if (items.length > 2) throw new Fault('A run is written [first, …, last] or [first, second, …, last].');
        return { kind: 'range', from, second, to };
      }
      items.push(this.sum());
      if (this.isOp(',')) {
        this.at += 1;
        continue;
      }
      this.want(']', 'A [ with no ] after it.');
      return { kind: 'list', items };
    }
  }

  /** A name: a variable, a constant, a function call, or a big operator with limits. */
  private named(t: Tok): Node {
    let name = t.value;

    const big = BIGS[name];
    if (big) return this.bigOperator(big);

    let base: Node | null = null;
    if (this.isOp('_')) {
      this.at += 1;
      const sub = this.subscript();
      // `\log_2 8` is a base, not a variable called log_2. Every other
      // subscript is part of the name — `P_2`, `x_i`, `Q_{max}` are what the
      // formulas in this app are written in.
      if (name === 'log') base = sub.node;
      else name = `${name}_${sub.text}`;
    }

    if (this.isOp('(')) {
      const known = FUNCTIONS[name.toLowerCase()];
      this.at += 1;
      const args: Node[] = [];
      if (!this.isOp(')')) {
        for (;;) {
          args.push(this.sum());
          if (this.isOp(',')) {
            this.at += 1;
            continue;
          }
          break;
        }
      }
      this.want(')', `${name}( with no ) after it.`);
      if (known || name === 'log') {
        if (base) args.push(base);
        return { kind: 'call', name: name.toLowerCase(), args };
      }
      // Not a function this ships: it is either one somebody defined above or
      // a variable beside a bracket. Which, is decided when it is worked out.
      return { kind: 'apply', name, args };
    }

    // `\sqrt{x}`, `sin x`, `ln 2` — a function applied without brackets, which
    // is how a textbook writes it. It takes one tight argument, so `sin x + 1`
    // is sin(x) plus one, as everybody reads it.
    const fn = FUNCTIONS[name.toLowerCase()];
    if (fn && fn.bare && this.starts()) {
      const arg = this.power();
      return { kind: 'call', name: name.toLowerCase(), args: base ? [arg, base] : [arg] };
    }
    if (base) return { kind: 'call', name: 'log', args: [this.power(), base] };
    return { kind: 'name', name };
  }

  private subscript(): { node: Node; text: string } {
    if (this.isOp('{')) {
      const start = this.at;
      const node = this.group('{', '}', '');
      const text = this.toks
        .slice(start + 1, this.at - 1)
        .map((s) => s.value)
        .join('');
      return { node, text };
    }
    const t = this.take();
    if (!t) throw new Fault('A subscript with nothing after it.');
    const node: Node = t.kind === 'num' ? { kind: 'num', value: Number(t.value) } : { kind: 'name', name: t.value };
    return { node, text: t.value };
  }

  /** `\sum_{i=1}^{n}` and what follows it, which is the term rather than the line. */
  private bigOperator(op: 'sum' | 'prod'): Node {
    this.want('_', 'A sum wants its limits — \\sum_{i=1}^{n}.');
    const opened = this.isOp('{');
    if (opened) this.at += 1;
    const name = this.take();
    if (!name || name.kind !== 'name') throw new Fault('A sum counts with a letter — \\sum_{i=1}^{n}.');
    this.want('=', 'A sum starts its counter with = — \\sum_{i=1}^{n}.');
    const from = this.sum();
    if (opened) this.want('}', 'A { with no } after it.');
    this.want('^', 'A sum wants a top limit — \\sum_{i=1}^{n}.');
    const to = this.argument();
    // The body is the term, not the line: `\sum_{i=1}^{n} x + 3` sums x and
    // then adds three, which is how it is read on paper.
    const body = this.product();
    return { kind: 'big', op, index: name.value, from, to, body };
  }
}

class Fault extends Error {}

/**
 * The expression as a tree, or a sentence saying what is wrong with it.
 *
 * Never throws. Every caller here is a keystroke handler, and half of what
 * somebody types is briefly unfinished — `sin(` on the way to `sin(x)` — so an
 * incomplete expression has to be an ordinary answer rather than an event.
 */
export function read(source: string): Read {
  const text = source.trim();
  if (!text) return { ok: false, fault: 'Nothing to work out yet.' };
  const toks = lex(text);
  if (typeof toks === 'string') return { ok: false, fault: toks };
  if (toks.length === 0) return { ok: false, fault: 'Nothing to work out yet.' };
  const parser = new Parser(toks);
  try {
    const node = parser.sum();
    if (!parser.done()) {
      const left = parser.rest();
      return { ok: false, fault: `“${left?.value ?? ''}” is left over at the end.` };
    }
    return { ok: true, node };
  } catch (e) {
    if (e instanceof Fault) return { ok: false, fault: e.message };
    return { ok: false, fault: 'This is not notation this can read.' };
  }
}

// ── Working it out ───────────────────────────────────────────────────────

/** π and the rest, where they are not variables. `e` yields to a binding — see `value`. */
export const CONSTANTS: Record<string, number> = {
  π: Math.PI,
  pi: Math.PI,
  τ: Math.PI * 2,
  tau: Math.PI * 2,
  e: Math.E,
  φ: (1 + Math.sqrt(5)) / 2,
  phi: (1 + Math.sqrt(5)) / 2,
  '∞': Infinity,
};

const flat = (v: Val): number[] => (Array.isArray(v) ? v : [v]);
const one = (v: Val): number => (Array.isArray(v) ? (v.length === 1 ? v[0] : NaN) : v);

/** A function of one number, over a number or over every member of a list. */
function map1(v: Val, f: (x: number) => number): Val {
  return Array.isArray(v) ? v.map(f) : f(v);
}

/**
 * Two values, worked elementwise.
 *
 * `2 * [1, 2, 3]` is `[2, 4, 6]`; two lists of the same length pair up; two of
 * different lengths are `NaN` rather than the shorter one silently truncated,
 * which is the mistake a gradebook makes when its weights column is a row
 * short. See `SUMPRODUCT` in `lib/sheet.ts`, which refuses the same thing for
 * the same reason.
 */
function map2(a: Val, b: Val, f: (x: number, y: number) => number): Val {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return NaN;
    return a.map((x, i) => f(x, b[i]));
  }
  if (Array.isArray(a)) return a.map((x) => f(x, b as number));
  if (Array.isArray(b)) return b.map((y) => f(a as number, y));
  return f(a, b);
}

interface Fn {
  /** How many arguments, for the message when it is given the wrong number. `0` means any. */
  arity: number;
  /** Whether it may be written without brackets — `sin x`, `ln 2`. */
  bare?: boolean;
  run: (args: Val[], scope: Scope) => Val;
}

const toRad = (scope: Scope) => (scope.degrees ? Math.PI / 180 : 1);

const stats = {
  total: (xs: number[]) => xs.reduce((t, x) => t + x, 0),
  mean: (xs: number[]) => (xs.length ? stats.total(xs) / xs.length : NaN),
  sorted: (xs: number[]) => [...xs].sort((a, b) => a - b),
  median: (xs: number[]) => {
    if (!xs.length) return NaN;
    const s = stats.sorted(xs);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  },
  squares: (xs: number[]) => {
    const m = stats.mean(xs);
    return stats.total(xs.map((x) => (x - m) ** 2));
  },
};

/** Whole numbers only: Γ is a different program, and a wrong 2.5! is worse than none. */
function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) return NaN;
  let out = 1;
  for (let i = 2; i <= n; i += 1) out *= i;
  return out;
}

function choose(n: number, k: number): number {
  if (!Number.isInteger(n) || !Number.isInteger(k) || k < 0 || n < 0 || k > n) return NaN;
  let out = 1;
  for (let i = 1; i <= k; i += 1) out = (out * (n - k + i)) / i;
  return Math.round(out);
}

const trig = (f: (x: number) => number): Fn => ({
  arity: 1,
  bare: true,
  run: (a, scope) => map1(a[0], (x) => f(x * toRad(scope))),
});

const inverse = (f: (x: number) => number): Fn => ({
  arity: 1,
  bare: true,
  run: (a, scope) => map1(a[0], (x) => f(x) / toRad(scope)),
});

const over = (f: (xs: number[]) => number): Fn => ({
  arity: 0,
  run: (a) => f(a.flatMap(flat)),
});

/**
 * Every function this knows, and nothing beyond them.
 *
 * An unknown name is a variable, not a function — so `foo(2)` is foo times
 * two rather than an error, which is what somebody who wrote `2(x+1)` meant
 * and never what `\foo` meant. The list is the trigonometry a physics or
 * methods course uses, the logarithms an econ course uses, the rounding
 * everybody uses, and the summary statistics that are the whole of a first
 * statistics course.
 */
export const FUNCTIONS: Record<string, Fn> = {
  sin: trig(Math.sin),
  cos: trig(Math.cos),
  tan: trig(Math.tan),
  csc: trig((x) => 1 / Math.sin(x)),
  sec: trig((x) => 1 / Math.cos(x)),
  cot: trig((x) => 1 / Math.tan(x)),
  asin: inverse(Math.asin),
  arcsin: inverse(Math.asin),
  acos: inverse(Math.acos),
  arccos: inverse(Math.acos),
  atan: inverse(Math.atan),
  arctan: inverse(Math.atan),
  sinh: { arity: 1, bare: true, run: (a) => map1(a[0], Math.sinh) },
  cosh: { arity: 1, bare: true, run: (a) => map1(a[0], Math.cosh) },
  tanh: { arity: 1, bare: true, run: (a) => map1(a[0], Math.tanh) },
  atan2: { arity: 2, run: (a, scope) => map2(a[0], a[1], (y, x) => Math.atan2(y, x) / toRad(scope)) },
  ln: { arity: 1, bare: true, run: (a) => map1(a[0], Math.log) },
  exp: { arity: 1, bare: true, run: (a) => map1(a[0], Math.exp) },
  sqrt: { arity: 1, bare: true, run: (a) => map1(a[0], Math.sqrt) },
  cbrt: { arity: 1, bare: true, run: (a) => map1(a[0], Math.cbrt) },
  abs: { arity: 1, bare: true, run: (a) => map1(a[0], Math.abs) },
  sign: { arity: 1, run: (a) => map1(a[0], Math.sign) },
  floor: { arity: 1, run: (a) => map1(a[0], Math.floor) },
  ceil: { arity: 1, run: (a) => map1(a[0], Math.ceil) },
  // `log` is base ten unless a base is given — `log_2 8`, or `log(8, 2)`.
  log: {
    arity: 0,
    bare: true,
    run: (a) => (a.length > 1 ? map2(a[0], a[1], (x, b) => Math.log(x) / Math.log(b)) : map1(a[0], Math.log10)),
  },
  root: { arity: 2, run: (a) => map2(a[0], a[1], (n, x) => Math.sign(x) * Math.abs(x) ** (1 / n)) },
  round: {
    arity: 0,
    run: (a) => {
      const places = a.length > 1 ? Math.round(one(a[1])) : 0;
      const scale = 10 ** places;
      return map1(a[0], (x) => Math.round(x * scale) / scale);
    },
  },
  mod: { arity: 2, run: (a) => map2(a[0], a[1], (x, y) => ((x % y) + y) % y) },
  gcd: { arity: 2, run: (a) => map2(a[0], a[1], (x, y) => {
    let [p, q] = [Math.abs(Math.round(x)), Math.abs(Math.round(y))];
    while (q) [p, q] = [q, p % q];
    return p;
  }) },
  min: over((xs) => (xs.length ? Math.min(...xs) : NaN)),
  max: over((xs) => (xs.length ? Math.max(...xs) : NaN)),
  total: over(stats.total),
  sum: over(stats.total),
  count: over((xs) => xs.length),
  mean: over(stats.mean),
  average: over(stats.mean),
  median: over(stats.median),
  /** The sample standard deviation, n − 1, because student data is a sample. */
  stdev: over((xs) => (xs.length > 1 ? Math.sqrt(stats.squares(xs) / (xs.length - 1)) : NaN)),
  stdevp: over((xs) => (xs.length ? Math.sqrt(stats.squares(xs) / xs.length) : NaN)),
  var: over((xs) => (xs.length > 1 ? stats.squares(xs) / (xs.length - 1) : NaN)),
  varp: over((xs) => (xs.length ? stats.squares(xs) / xs.length : NaN)),
  nCr: { arity: 2, run: (a) => map2(a[0], a[1], choose) },
  ncr: { arity: 2, run: (a) => map2(a[0], a[1], choose) },
  npr: { arity: 2, run: (a) => map2(a[0], a[1], (n, k) => choose(n, k) * factorial(k)) },
};

/** How deep a definition may stand on another, before `f(x) = f(x)` takes the tab with it. */
const DEEPEST = 60;

/**
 * What an expression comes to.
 *
 * `NaN` where the arithmetic has no answer — `ln(-1)`, `0/0`, a name nothing
 * has bound — because a plot wants a gap there and a calculator wants to say
 * "no answer here", and both are better served by one value that means
 * "undefined" than by an exception either would have to catch.
 */
export function value(node: Node, scope: Scope = {}, depth = 0): Val {
  if (depth > DEEPEST) return NaN;
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'name': {
      const bound = scope.vars?.[node.name];
      if (bound !== undefined) return bound;
      const constant = CONSTANTS[node.name];
      return constant === undefined ? NaN : constant;
    }
    case 'list':
      return node.items.flatMap((item) => flat(value(item, scope, depth + 1)));
    case 'range': {
      const from = one(value(node.from, scope, depth + 1));
      const to = one(value(node.to, scope, depth + 1));
      const step = node.second ? one(value(node.second, scope, depth + 1)) - from : Math.sign(to - from) || 1;
      if (!Number.isFinite(from) || !Number.isFinite(to) || !step) return NaN;
      const count = Math.floor((to - from) / step + 1e-9);
      // A run somebody can see the end of. Past ten thousand it is data, and
      // data belongs in a sheet where it can be scrolled.
      if (count < 0 || count > 10_000) return NaN;
      return Array.from({ length: count + 1 }, (_, i) => from + i * step);
    }
    case 'neg':
      return map1(value(node.body, scope, depth + 1), (x) => -x);
    case 'op': {
      const left = value(node.left, scope, depth + 1);
      const right = value(node.right, scope, depth + 1);
      switch (node.op) {
        case '+':
          return map2(left, right, (a, b) => a + b);
        case '-':
          return map2(left, right, (a, b) => a - b);
        case '*':
          return map2(left, right, (a, b) => a * b);
        case '/':
          return map2(left, right, (a, b) => a / b);
        case '^':
          return map2(left, right, raise);
      }
      return NaN;
    }
    case 'abs':
      return map1(value(node.body, scope, depth + 1), Math.abs);
    case 'fact':
      return map1(value(node.body, scope, depth + 1), factorial);
    case 'percent':
      return map1(value(node.body, scope, depth + 1), (x) => x / 100);
    case 'big':
      return bigValue(node, scope, depth);
    case 'call':
      return callValue(node, scope, depth);
    case 'apply': {
      const own = scope.funs?.[node.name];
      if (own) return callValue({ kind: 'call', name: node.name, args: node.args }, scope, depth);
      // Nobody defined it, so it is the multiplication it looks like —
      // `a(x + 1)`, which is what somebody with a slider called `a` meant.
      if (node.args.length !== 1) return NaN;
      const left = value({ kind: 'name', name: node.name }, scope, depth + 1);
      return map2(left, value(node.args[0], scope, depth + 1), (a, b) => a * b);
    }
  }
}

/**
 * `x^y`, including the negative bases a graph runs into.
 *
 * `(-8)^(1/3)` is `NaN` to IEEE-754 and −2 to every algebra course, and a
 * curve that vanishes for all negative x is the visible form of that
 * disagreement. The odd roots are taken on the magnitude and the sign put
 * back; everything else is left as the arithmetic says.
 */
function raise(base: number, power: number): number {
  if (base >= 0 || Number.isInteger(power)) return base ** power;
  const inverted = 1 / power;
  if (Math.abs(inverted - Math.round(inverted)) < 1e-9 && Math.round(inverted) % 2 !== 0) {
    return -((-base) ** power);
  }
  return NaN;
}

function bigValue(node: Extract<Node, { kind: 'big' }>, scope: Scope, depth: number): Val {
  const from = one(value(node.from, scope, depth + 1));
  const to = one(value(node.to, scope, depth + 1));
  if (!Number.isFinite(from) || !Number.isFinite(to)) return NaN;
  const steps = Math.floor(to - Math.ceil(from));
  if (steps < 0) return node.op === 'sum' ? 0 : 1;
  // The same ceiling the lists take, and for the same reason: past this it is
  // a program rather than a formula, and it would lock the screen.
  if (steps > 10_000) return NaN;
  let out: Val = node.op === 'sum' ? 0 : 1;
  for (let i = Math.ceil(from); i <= to; i += 1) {
    const inner = value(node.body, { ...scope, vars: { ...scope.vars, [node.index]: i } }, depth + 1);
    out = map2(out, inner, node.op === 'sum' ? (a, b) => a + b : (a, b) => a * b);
  }
  return out;
}

function callValue(node: Extract<Node, { kind: 'call' }>, scope: Scope, depth: number): Val {
  const args = node.args.map((a) => value(a, scope, depth + 1));
  const own = scope.funs?.[node.name];
  if (own) {
    const vars = { ...scope.vars };
    own.params.forEach((p, i) => {
      vars[p] = args[i] ?? NaN;
    });
    return value(own.body, { ...scope, vars }, depth + 1);
  }
  const fn = FUNCTIONS[node.name];
  if (!fn) return NaN;
  if (fn.arity !== 0 && args.length !== fn.arity) return NaN;
  return fn.run(args, scope);
}

/**
 * Every name the expression needs that nothing has given it a value for.
 *
 * What a screen asks somebody to fill in, and what tells a plot it cannot be
 * drawn yet. Constants and the functions it knows are not free, and neither is
 * a function's own parameter inside its body.
 */
export function free(node: Node, scope: Scope = {}, bound: string[] = []): string[] {
  const out: string[] = [];
  const walk = (n: Node, inner: string[]) => {
    switch (n.kind) {
      case 'name': {
        const known =
          inner.includes(n.name) ||
          scope.vars?.[n.name] !== undefined ||
          CONSTANTS[n.name] !== undefined;
        if (!known && !out.includes(n.name)) out.push(n.name);
        return;
      }
      case 'call': {
        if (!FUNCTIONS[n.name] && !scope.funs?.[n.name] && !out.includes(n.name)) out.push(n.name);
        n.args.forEach((a) => walk(a, inner));
        return;
      }
      case 'apply': {
        // Free as a name when nothing has defined it as a function — which is
        // the reading it would take, so it is the one reported as missing.
        if (!scope.funs?.[n.name]) walk({ kind: 'name', name: n.name }, inner);
        n.args.forEach((a) => walk(a, inner));
        return;
      }
      case 'op':
        walk(n.left, inner);
        walk(n.right, inner);
        return;
      case 'neg':
      case 'abs':
      case 'fact':
      case 'percent':
        walk(n.body, inner);
        return;
      case 'list':
        n.items.forEach((i) => walk(i, inner));
        return;
      case 'range':
        walk(n.from, inner);
        if (n.second) walk(n.second, inner);
        walk(n.to, inner);
        return;
      case 'big':
        walk(n.from, inner);
        walk(n.to, inner);
        walk(n.body, [...inner, n.index]);
        return;
      case 'num':
    }
  };
  walk(node, bound);
  return out;
}

/**
 * A value as text.
 *
 * Twelve significant figures and then the trailing zeros taken off, which is
 * the same rule `show` follows in `lib/sheet.ts` and for the same reason: any
 * fewer loses a genuine third, any more shows `0.30000000000000004` and reads
 * as a bug in the app rather than as a fact about binary fractions.
 */
export function text(v: Val): string {
  if (Array.isArray(v)) {
    const shown = v.slice(0, 12).map(text);
    return `[${shown.join(', ')}${v.length > shown.length ? `, … ${v.length} in all` : ''}]`;
  }
  if (Number.isNaN(v)) return '—';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  return Number.parseFloat(v.toPrecision(12)).toString();
}

/** Read it and work it out, which is what a screen with one box wants. */
export function calculate(source: string, scope: Scope = {}): { value: Val } | { fault: string } {
  const got = read(source);
  if (!got.ok) return { fault: got.fault };
  return { value: value(got.node, scope) };
}
