/**
 * Equations: written once, read three ways.
 *
 * A student in econ and statistics writes the same formula into a problem set,
 * a slide and a note, and until now the app had nothing to offer but plain
 * text — `(P2-P1)/((P2+P1)/2)`, which is not what the syllabus prints and not
 * what a marker wants to read.
 *
 * So there is one notation and three renderings of it:
 *
 *   **MathML**, for the screen. Every current browser lays it out natively —
 *   no library, no font to ship, and it stays selectable and readable to a
 *   screen reader, which a picture of an equation is not.
 *   **OMML**, for Word. A .docx equation is a real equation object, editable
 *   in Word rather than an image somebody has to retype.
 *   **Unicode**, for everywhere else — a slide, a CSV cell, a chat message,
 *   an alt text. Lossy on purpose and honest about it.
 *
 * ## The notation
 *
 * A deliberately small piece of LaTeX, because that is what a syllabus, a
 * textbook and every model this app talks to already write. `\frac{a}{b}`,
 * `x^2`, `\sqrt{2}`, `\sum_{i=1}^{n}`, `\bar{x}`, `\text{elasticity}`, the
 * greek letters, and the operators. Anything outside it is left as the
 * characters it is made of rather than being refused — an equation that
 * renders imperfectly is more use than an error message, and the person can
 * see what happened and fix it.
 *
 * ## What it will not do
 *
 * It will not compute. Nothing here evaluates an equation, substitutes a value
 * or rearranges anything: `lib/sheet.ts` does arithmetic and says so. An
 * equation renderer that quietly simplified would be a second calculator
 * nobody had tested.
 */

export type Node =
  /** Letters, digits and operators, as they are. Variables lean, numbers do not. */
  | { kind: 'run'; text: string; italic: boolean }
  /** Words inside an equation — `\text{price}` — upright and spaced as prose. */
  | { kind: 'text'; text: string }
  | { kind: 'row'; items: Node[] }
  | { kind: 'frac'; num: Node; den: Node }
  | { kind: 'script'; base: Node; sub?: Node; sup?: Node; big: boolean }
  | { kind: 'sqrt'; body: Node; index?: Node }
  | { kind: 'fenced'; open: string; close: string; body: Node }
  | { kind: 'over'; body: Node; accent: string };

/**
 * The symbols this understands, and nothing beyond them.
 *
 * Chosen from what the four courses actually print: the greek an econ or
 * statistics course uses, the relations a proof uses, and the arrows a causal
 * claim uses. A command that is not here comes through as its own letters,
 * which reads as a mistake rather than as an error — and it is one the person
 * can see and correct.
 */
export const SYMBOLS: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  Delta: 'Δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  eta: 'η',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  pi: 'π',
  Pi: 'Π',
  rho: 'ρ',
  sigma: 'σ',
  Sigma: 'Σ',
  tau: 'τ',
  phi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Omega: 'Ω',
  times: '×',
  div: '÷',
  cdot: '·',
  pm: '±',
  mp: '∓',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  approx: '≈',
  equiv: '≡',
  propto: '∝',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  Rightarrow: '⇒',
  infty: '∞',
  partial: '∂',
  nabla: '∇',
  in: '∈',
  notin: '∉',
  subset: '⊂',
  cup: '∪',
  cap: '∩',
  forall: '∀',
  exists: '∃',
  ldots: '…',
  cdots: '⋯',
  percent: '%',
};

/** Operators that take limits above and below rather than beside. */
export const BIG: Record<string, string> = {
  sum: '∑',
  prod: '∏',
  int: '∫',
  iint: '∬',
  oint: '∮',
  lim: 'lim',
  max: 'max',
  min: 'min',
};

/** Words that stay upright inside an equation, because they are names not products. */
const UPRIGHT = new Set(['log', 'ln', 'exp', 'sin', 'cos', 'tan', 'det', 'mod', 'Pr', 'Var', 'Cov', 'E']);

const ACCENTS: Record<string, string> = {
  bar: '‾',
  overline: '‾',
  hat: '^',
  widehat: '^',
  tilde: '~',
  vec: '→',
  dot: '˙',
};

// ── Reading it ───────────────────────────────────────────────────────────

type Token = { kind: 'cmd' | 'char'; value: string };

function lex(source: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '\\') {
      /*
       * The trailing space belongs to the command, not to the equation.
       *
       * `\\Delta Q` is two atoms in LaTeX and the space between them is how
       * the name ends — it is not a gap. Left in, it renders as `Δ Q` with a
       * visible space, which reads as a typo in somebody's formula. Only after
       * a word: `\\,` and `\\ ` are the explicit spaces and are single-character
       * commands, so they come through this branch untouched.
       */
      const m = /^\\(?:([A-Za-z]+)[ \t]*|(.))/.exec(source.slice(i));
      if (!m) {
        i += 1;
        continue;
      }
      out.push({ kind: 'cmd', value: m[1] ?? m[2] });
      i += m[0].length;
      continue;
    }
    out.push({ kind: 'char', value: ch });
    i += 1;
  }
  return out;
}

const row = (items: Node[]): Node =>
  items.length === 1 ? items[0] : { kind: 'row', items };

const empty = (): Node => ({ kind: 'row', items: [] });

class Reader {
  private at = 0;

  private readonly tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.at];
  }

  /** Everything up to the end, or up to the `}` that closes the group we are in. */
  row(stopAtBrace = false): Node {
    const items: Node[] = [];
    for (;;) {
      const t = this.peek();
      if (!t) break;
      if (stopAtBrace && t.kind === 'char' && t.value === '}') break;
      if (t.kind === 'char' && (t.value === '^' || t.value === '_')) {
        // A script with nothing before it — `^2` on its own. Attached to an
        // empty base rather than dropped, so what was typed is still visible.
        items.push(this.scripts(empty()));
        continue;
      }
      const atom = this.atom();
      if (!atom) break;
      items.push(this.scripts(atom));
    }
    return row(items);
  }

  /** A `{…}` group, or the single token that stands in for one — `x^2`, not `x^{2}`. */
  private argument(): Node {
    const t = this.peek();
    if (!t) return empty();
    if (t.kind === 'char' && t.value === '{') {
      this.at += 1;
      const inner = this.row(true);
      // A missing `}` is a typo, not a reason to lose the rest of the line.
      const close = this.peek();
      if (close && close.kind === 'char' && close.value === '}') this.at += 1;
      return inner;
    }
    const single = this.atom();
    return single ?? empty();
  }

  /** The trailing `_…` and `^…`, in either order, attached to what came before. */
  private scripts(base: Node): Node {
    let sub: Node | undefined;
    let sup: Node | undefined;
    for (;;) {
      const t = this.peek();
      if (!t || t.kind !== 'char' || (t.value !== '_' && t.value !== '^')) break;
      this.at += 1;
      if (t.value === '_') sub = this.argument();
      else sup = this.argument();
    }
    if (!sub && !sup) return base;
    const big = base.kind === 'run' && Object.values(BIG).includes(base.text);
    return { kind: 'script', base, sub, sup, big };
  }

  private atom(): Node | null {
    const t = this.peek();
    if (!t) return null;

    if (t.kind === 'cmd') {
      this.at += 1;
      const name = t.value;
      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        return { kind: 'frac', num: this.argument(), den: this.argument() };
      }
      if (name === 'sqrt') {
        const next = this.peek();
        let index: Node | undefined;
        if (next && next.kind === 'char' && next.value === '[') {
          this.at += 1;
          const items: Node[] = [];
          for (;;) {
            const inner = this.peek();
            if (!inner || (inner.kind === 'char' && inner.value === ']')) break;
            const a = this.atom();
            if (!a) break;
            items.push(a);
          }
          if (this.peek()) this.at += 1;
          index = row(items);
        }
        return { kind: 'sqrt', body: this.argument(), index };
      }
      if (name === 'text' || name === 'mathrm' || name === 'operatorname') {
        return { kind: 'text', text: flatten(this.argument()) };
      }
      if (ACCENTS[name]) return { kind: 'over', body: this.argument(), accent: ACCENTS[name] };
      if (name === 'left' || name === 'right') {
        // `\left(` and `\right)` are the delimiter that follows, sized. The
        // sizing is the renderer's business, so only the character is kept.
        const next = this.peek();
        if (next) {
          this.at += 1;
          if (next.value === '.') return null;
          return { kind: 'run', text: next.value, italic: false };
        }
        return null;
      }
      if (BIG[name]) return { kind: 'run', text: BIG[name], italic: false };
      if (SYMBOLS[name]) return { kind: 'run', text: SYMBOLS[name], italic: false };
      if (UPRIGHT.has(name)) return { kind: 'text', text: name };
      if (name === ',' || name === ';' || name === ' ') return { kind: 'run', text: ' ', italic: false };
      // Unknown: shown as typed, because a person can fix what they can see.
      return { kind: 'text', text: name };
    }

    this.at += 1;
    const ch = t.value;
    if (ch === '{') {
      const inner = this.row(true);
      const close = this.peek();
      if (close && close.kind === 'char' && close.value === '}') this.at += 1;
      return inner;
    }
    if (ch === '}') return null;
    if (/\d/.test(ch)) {
      // Digits gather, so `1000` is one number rather than four runs — which
      // matters to Word, where four runs can be broken across a line.
      let text = ch;
      for (;;) {
        const next = this.peek();
        if (!next || next.kind !== 'char' || !/[\d.]/.test(next.value)) break;
        text += next.value;
        this.at += 1;
      }
      return { kind: 'run', text, italic: false };
    }
    if (/[A-Za-z]/.test(ch)) return { kind: 'run', text: ch, italic: true };
    if (ch === ' ') return { kind: 'run', text: ' ', italic: false };
    return { kind: 'run', text: ch, italic: false };
  }
}

/** The equation as a tree. Never throws: bad notation renders as itself. */
export function parse(source: string): Node {
  return new Reader(lex(source)).row();
}

/** A node's text with all its structure dropped — for `\text{…}` and for names. */
function flatten(node: Node): string {
  switch (node.kind) {
    case 'run':
    case 'text':
      return node.text;
    case 'row':
      return node.items.map(flatten).join('');
    case 'frac':
      return `${flatten(node.num)}/${flatten(node.den)}`;
    case 'script':
      return flatten(node.base) + (node.sub ? `_${flatten(node.sub)}` : '') + (node.sup ? `^${flatten(node.sup)}` : '');
    case 'sqrt':
      return `√${flatten(node.body)}`;
    case 'fenced':
      return node.open + flatten(node.body) + node.close;
    case 'over':
      return flatten(node.body);
  }
}

// ── Rendering it ─────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

/**
 * MathML, for the screen.
 *
 * `<mi>` for a variable, `<mn>` for a number, `<mo>` for an operator — the
 * distinction is not decoration, it is what gives the spacing around `=` and
 * the italic on `x`, and it is what a screen reader reads out as "x equals"
 * rather than as a string of characters.
 */
export function mathml(node: Node, display: 'block' | 'inline' = 'block'): string {
  const inner = render(node);
  return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="${display}">${inner}</math>`;
}

function render(node: Node): string {
  switch (node.kind) {
    case 'run': {
      const t = node.text;
      if (t === ' ') return '<mspace width="0.28em"/>';
      if (/^[\d.]+$/.test(t)) return `<mn>${esc(t)}</mn>`;
      if (node.italic) return `<mi>${esc(t)}</mi>`;
      if (/^[A-Za-zα-ωΑ-Ω]+$/.test(t)) return `<mi mathvariant="normal">${esc(t)}</mi>`;
      return `<mo>${esc(t)}</mo>`;
    }
    case 'text':
      return `<mtext>${esc(node.text)}</mtext>`;
    case 'row':
      return `<mrow>${node.items.map(render).join('')}</mrow>`;
    case 'frac':
      return `<mfrac>${wrap(node.num)}${wrap(node.den)}</mfrac>`;
    case 'sqrt':
      return node.index
        ? `<mroot>${wrap(node.body)}${wrap(node.index)}</mroot>`
        : `<msqrt>${wrap(node.body)}</msqrt>`;
    case 'fenced':
      return `<mrow><mo>${esc(node.open)}</mo>${wrap(node.body)}<mo>${esc(node.close)}</mo></mrow>`;
    case 'over':
      return `<mover accent="true">${wrap(node.body)}<mo>${esc(node.accent)}</mo></mover>`;
    case 'script': {
      const base = wrap(node.base);
      // A sum's limits go above and below it; a variable's go beside it. Same
      // tree, two elements, and using the wrong one is how ∑ ends up looking
      // like a subscripted letter.
      const tag = node.big ? ['munder', 'mover', 'munderover'] : ['msub', 'msup', 'msubsup'];
      if (node.sub && node.sup) return `<${tag[2]}>${base}${wrap(node.sub)}${wrap(node.sup)}</${tag[2]}>`;
      if (node.sub) return `<${tag[0]}>${base}${wrap(node.sub)}</${tag[0]}>`;
      return `<${tag[1]}>${base}${wrap(node.sup!)}</${tag[1]}>`;
    }
  }
}

/** A child that has to be exactly one element, as MathML's positional slots require. */
function wrap(node: Node): string {
  const out = render(node);
  return node.kind === 'row' ? out : `<mrow>${out}</mrow>`;
}

/**
 * OMML, for Word.
 *
 * The same tree in Word's own math markup, so the equation in the .docx is a
 * real equation — click it and Word's editor opens on it.
 *
 * Big operators are written as ordinary sub-superscripts rather than as
 * `m:nary`. Nary is the more faithful element and it needs its operand
 * enclosed, which means knowing where the sum's body ends — and in this
 * notation it does not end anywhere in particular. Sub-superscript limits are
 * what inline maths does anyway, and every reader lays them out correctly.
 */
export function omml(node: Node): string {
  return `<m:oMath>${math(node)}</m:oMath>`;
}

function math(node: Node): string {
  switch (node.kind) {
    case 'run': {
      const style = node.italic ? '' : '<m:rPr><m:sty m:val="p"/></m:rPr>';
      return `<m:r>${style}<m:t xml:space="preserve">${esc(node.text)}</m:t></m:r>`;
    }
    case 'text':
      return `<m:r><m:rPr><m:sty m:val="p"/></m:rPr><m:t xml:space="preserve">${esc(node.text)}</m:t></m:r>`;
    case 'row':
      return node.items.map(math).join('');
    case 'frac':
      return `<m:f><m:fPr><m:type m:val="bar"/></m:fPr><m:num>${math(node.num)}</m:num><m:den>${math(node.den)}</m:den></m:f>`;
    case 'sqrt':
      return node.index
        ? `<m:rad><m:deg>${math(node.index)}</m:deg><m:e>${math(node.body)}</m:e></m:rad>`
        : `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${math(node.body)}</m:e></m:rad>`;
    case 'fenced':
      return (
        `<m:d><m:dPr><m:begChr m:val="${esc(node.open)}"/><m:endChr m:val="${esc(node.close)}"/></m:dPr>` +
        `<m:e>${math(node.body)}</m:e></m:d>`
      );
    case 'over':
      return `<m:acc><m:accPr><m:chr m:val="${esc(node.accent)}"/></m:accPr><m:e>${math(node.body)}</m:e></m:acc>`;
    case 'script': {
      const base = `<m:e>${math(node.base)}</m:e>`;
      if (node.sub && node.sup) {
        return `<m:sSubSup>${base}<m:sub>${math(node.sub)}</m:sub><m:sup>${math(node.sup)}</m:sup></m:sSubSup>`;
      }
      if (node.sub) return `<m:sSub>${base}<m:sub>${math(node.sub)}</m:sub></m:sSub>`;
      return `<m:sSup>${base}<m:sup>${math(node.sup!)}</m:sup></m:sSup>`;
    }
  }
}

/** Digits as their superscript characters, where every one of them exists. */
const SUPERS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ',
};
const SUBS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', n: 'ₙ', t: 'ₜ', x: 'ₓ',
};

/** The operators that read as a relation, and want air around them in one line. */
const SPACED = new Set(['=', '≤', '≥', '≠', '≈', '≡', '∝', '→', '←', '⇒', '±', '∓', '×', '÷', '∈', '∉', '<', '>']);

function tiny(text: string, table: Record<string, string>): string | null {
  let out = '';
  for (const ch of text) {
    const small = table[ch];
    if (!small) return null;
    out += small;
  }
  return out;
}

/**
 * The equation as one line of ordinary text.
 *
 * For a slide, a cell, a chat message, a filename. Lossy and meant to be: a
 * fraction becomes `(a)/(b)` with the brackets kept, because `a/b+c` and
 * `a/(b+c)` are different equations and dropping the brackets is the one
 * lossy step that changes the answer rather than the look.
 *
 * Superscripts and subscripts use the real characters where they exist —
 * `x²`, `xᵢ` — and fall back to `x^(2)` where they do not. Half a superscript
 * would be worse than none.
 */
export function plain(node: Node, tight = false): string {
  switch (node.kind) {
    case 'run':
    case 'text':
      return node.text;
    case 'row': {
      /*
       * A relation gets a space either side, whatever the source did.
       *
       * `\\le` swallows its own trailing space — that space is how the command's
       * name ends — so `a \\le b` would otherwise come out as `a ≤b`, which is
       * what somebody pastes into an email. On screen this never arises:
       * MathML spaces its own operators. Here it has to be done, and only for
       * relations: `+` and `-` are left tight, because `b+c` inside a fraction
       * is how arithmetic is written and spacing it out helps nobody.
       */
      let out = '';
      node.items.forEach((item) => {
        const text = plain(item, tight);
        if (!tight && item.kind === 'run' && SPACED.has(item.text.trim())) {
          out = `${out.replace(/\s+$/, '')} ${text.trim()} `;
        } else {
          out += text;
        }
      });
      return out.replace(/ {2,}/g, ' ').trimEnd();
    }
    case 'frac':
      return `(${plain(node.num, tight)})/(${plain(node.den, tight)})`;
    case 'sqrt': {
      const body = `√(${plain(node.body, tight)})`;
      return node.index ? `${plain(node.index, tight)}${body}` : body;
    }
    case 'fenced':
      return node.open + plain(node.body, tight) + node.close;
    case 'over':
      // The combining overline, so `\bar{x}` is one glyph rather than two.
      return node.accent === '‾'
        ? `${plain(node.body, tight)}̄`
        : `${plain(node.body, tight)}${node.accent}`;
    case 'script': {
      /*
       * A script is always tight, whatever it holds.
       *
       * `\sum_{i=1}^{n}` has an `=` in its subscript, and spacing it would
       * make the subscript `i = 1` — which has a space in it, and there is no
       * subscript space character, so the whole limit would fall back to
       * `_(i = 1)` and the sum would stop looking like a sum.
       */
      let out = plain(node.base, tight);
      if (node.sub) {
        const inner = plain(node.sub, true);
        out += tiny(inner, SUBS) ?? `_(${inner})`;
      }
      if (node.sup) {
        const inner = plain(node.sup, true);
        out += tiny(inner, SUPERS) ?? `^(${inner})`;
      }
      return out;
    }
  }
}

/** The three renderings at once, from the source — what a screen and a writer both want. */
export function renderAll(source: string): { mathml: string; omml: string; plain: string } {
  const tree = parse(source);
  return { mathml: mathml(tree), omml: omml(tree), plain: plain(tree) };
}

// ── The formulas a term actually uses ────────────────────────────────────

export interface Formula {
  id: string;
  /** What it is called, as a course calls it. */
  name: string;
  /** Which body of material it belongs to, for grouping the list. */
  field: 'Economics' | 'Statistics' | 'Business' | 'Method';
  latex: string;
  /** What it says, in a sentence — never a derivation. */
  says: string;
  /** Every letter in it, named. A formula whose symbols are unexplained is a picture. */
  where: { symbol: string; means: string }[];
}

/**
 * A starting library, rather than a blank box.
 *
 * The blank box is the reason equation editors go unused: knowing that
 * `\frac` exists is a different skill from knowing the formula, and a student
 * who has to learn the first before writing the second will open a different
 * application. These are the ones this app's own courses use — the midpoint
 * elasticity ECON 1020 marks by hand, the margin of error PSCI 1104 and
 * BUS 1600 both define, the break-even a business case turns on.
 *
 * Each carries its symbols named, because that is the half a picture of an
 * equation loses and the half a marker looks for.
 */
export const FORMULAS: Formula[] = [
  {
    id: 'elasticity',
    name: 'Price elasticity of demand (midpoint)',
    field: 'Economics',
    latex: 'E_d = \\frac{(Q_2 - Q_1)/((Q_2 + Q_1)/2)}{(P_2 - P_1)/((P_2 + P_1)/2)}',
    says: 'How much quantity moves for a given move in price, measured so it comes out the same in both directions.',
    where: [
      { symbol: 'Q', means: 'quantity demanded, before and after' },
      { symbol: 'P', means: 'price, before and after' },
      { symbol: 'E_d', means: 'elasticity — above 1 in absolute value is elastic' },
    ],
  },
  {
    id: 'growth',
    name: 'Real growth rate',
    field: 'Economics',
    latex: 'g = \\frac{X_t - X_{t-1}}{X_{t-1}} \\times 100',
    says: 'The percentage change from one period to the next.',
    where: [
      { symbol: 'X_t', means: 'the value this period' },
      { symbol: 'X_{t-1}', means: 'the value last period' },
    ],
  },
  {
    id: 'real-gdp',
    name: 'Real from nominal',
    field: 'Economics',
    latex: '\\text{Real} = \\frac{\\text{Nominal}}{\\text{Price index}} \\times 100',
    says: 'A money figure with inflation taken out, so two years can be compared.',
    where: [{ symbol: 'Price index', means: 'the CPI or deflator for that year' }],
  },
  {
    id: 'surplus',
    name: 'Consumer surplus on a linear demand curve',
    field: 'Economics',
    latex: 'CS = \\frac{1}{2} \\times Q \\times (P_{max} - P)',
    says: 'The triangle between what buyers would have paid and what they did pay.',
    where: [
      { symbol: 'P_{max}', means: 'the choke price, where quantity demanded is zero' },
      { symbol: 'P', means: 'the price actually paid' },
    ],
  },
  {
    id: 'pv',
    name: 'Present value',
    field: 'Business',
    latex: 'PV = \\frac{FV}{(1 + r)^n}',
    says: 'What a future amount is worth today at a given rate.',
    where: [
      { symbol: 'FV', means: 'the amount, later' },
      { symbol: 'r', means: 'the discount rate per period' },
      { symbol: 'n', means: 'how many periods' },
    ],
  },
  {
    id: 'npv',
    name: 'Net present value',
    field: 'Business',
    latex: 'NPV = \\sum_{t=0}^{n} \\frac{C_t}{(1 + r)^t}',
    says: 'Every cash flow of a project discounted back to today and added up.',
    where: [
      { symbol: 'C_t', means: 'the cash flow in period t, negative when it is a cost' },
      { symbol: 'r', means: 'the required rate of return' },
    ],
  },
  {
    id: 'breakeven',
    name: 'Break-even quantity',
    field: 'Business',
    latex: 'Q^* = \\frac{F}{P - V}',
    says: 'How many units cover the fixed costs.',
    where: [
      { symbol: 'F', means: 'fixed costs' },
      { symbol: 'P', means: 'price per unit' },
      { symbol: 'V', means: 'variable cost per unit' },
    ],
  },
  {
    id: 'mean',
    name: 'Sample mean',
    field: 'Statistics',
    latex: '\\bar{x} = \\frac{1}{n} \\sum_{i=1}^{n} x_i',
    says: 'The average of the values you have.',
    where: [
      { symbol: 'n', means: 'how many observations' },
      { symbol: 'x_i', means: 'the i-th observation' },
    ],
  },
  {
    id: 'sd',
    name: 'Sample standard deviation',
    field: 'Statistics',
    latex: 's = \\sqrt{\\frac{\\sum_{i=1}^{n} (x_i - \\bar{x})^2}{n - 1}}',
    says: 'How far a typical observation sits from the mean.',
    where: [{ symbol: 'n - 1', means: 'the sample correction — a population divides by n' }],
  },
  {
    id: 'z',
    name: 'z-score',
    field: 'Statistics',
    latex: 'z = \\frac{x - \\mu}{\\sigma}',
    says: 'How many standard deviations an observation is from the mean.',
    where: [
      { symbol: '\\mu', means: 'the population mean' },
      { symbol: '\\sigma', means: 'the population standard deviation' },
    ],
  },
  {
    id: 'moe',
    name: 'Margin of error for a proportion',
    field: 'Statistics',
    latex: 'MOE = z \\sqrt{\\frac{\\hat{p}(1 - \\hat{p})}{n}}',
    says: 'The half-width of a confidence interval around a poll result.',
    where: [
      { symbol: '\\hat{p}', means: 'the proportion in the sample' },
      { symbol: 'z', means: '1.96 for 95% confidence' },
      { symbol: 'n', means: 'the sample size' },
    ],
  },
  {
    id: 'ci',
    name: 'Confidence interval for a mean',
    field: 'Statistics',
    latex: '\\bar{x} \\pm z \\frac{s}{\\sqrt{n}}',
    says: 'The range the true mean is in, at the confidence the z stands for.',
    where: [{ symbol: 's', means: 'the sample standard deviation' }],
  },
  {
    id: 'slope',
    name: 'Regression slope',
    field: 'Statistics',
    latex: '\\beta = \\frac{\\sum (x_i - \\bar{x})(y_i - \\bar{y})}{\\sum (x_i - \\bar{x})^2}',
    says: 'How much y moves per unit of x, in the fitted line.',
    where: [{ symbol: '\\beta', means: 'the slope — the coefficient a paper reports' }],
  },
  {
    id: 'expected',
    name: 'Expected value',
    field: 'Method',
    latex: 'E[X] = \\sum_{i=1}^{n} p_i x_i',
    says: 'Each outcome weighted by how likely it is.',
    where: [
      { symbol: 'p_i', means: 'the probability of outcome i' },
      { symbol: 'x_i', means: 'what that outcome is worth' },
    ],
  },
  {
    id: 'weighted-grade',
    name: 'Weighted course mark',
    field: 'Method',
    latex: 'G = \\frac{\\sum w_i s_i}{\\sum w_i}',
    says: 'What a course mark comes to when the pieces count differently.',
    where: [
      { symbol: 'w_i', means: 'the weight on a category' },
      { symbol: 's_i', means: 'the score in it' },
    ],
  },
];

/**
 * An equation somebody kept.
 *
 * The library above ships with the app and never changes; this is the one
 * they wrote or edited, which does. Kept separately for the reason every
 * other pair like this in the app is kept separately: what the app knows and
 * what the student has said are different kinds of fact, and a screen that
 * mixes them cannot say which is which.
 */
export interface SavedEquation {
  id: string;
  name: string;
  latex: string;
  /** What it is for, in their words. Optional, and usually empty. */
  note: string;
  courseId: string | null;
  created: number;
}

/** A saved equation from a library entry, so "keep this one" is one tap. */
export function keepFrom(f: Formula, courseId: string | null = null): Omit<SavedEquation, 'id' | 'created'> {
  return { name: f.name, latex: f.latex, note: f.says, courseId };
}

export function formula(id: string): Formula | undefined {
  return FORMULAS.find((f) => f.id === id);
}

/** The fields, in the order the list draws them. */
export function fields(): Formula['field'][] {
  const out: Formula['field'][] = [];
  for (const f of FORMULAS) if (!out.includes(f.field)) out.push(f.field);
  return out;
}
