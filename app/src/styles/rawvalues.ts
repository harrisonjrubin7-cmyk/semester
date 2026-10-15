import { LEADING, SPACE, TYPE, sheets, sources, withoutComments, type Problem } from './rules.ts';

/**
 * The raw-value ledger for stylesheets, and for colour functions in `.tsx`.
 *
 * `scripts/design-system-css.mjs` is one way in and `rawvalues.test.ts` the
 * other, the arrangement `rules.ts` and `scripts/styles.mjs` already use, so a
 * rule cannot pass the suite and fail the command or the reverse. Node runs this
 * file directly, which is why it imports `./rules.ts` with its extension and
 * nothing else that is not a Node built-in.
 *
 * ## What this covers, and what it leaves to the checks beside it
 *
 * Already held elsewhere, and not counted here:
 *
 *   - `scripts/design-system-audit.mjs` counts numeric `zIndex`, `boxShadow`,
 *     `borderRadius`, `fontSize`, durations and easings in `.ts`/`.tsx` against
 *     `app/design-system-baseline.json`, and reports undefined custom properties
 *     and a Figma mapping that does not resolve. Two ledgers on one value would
 *     mean two files to update when it is fixed, so `.tsx` is its.
 *   - `hex.test.ts` holds quoted hex in `.tsx`; `rules.ts`/`budget.ts` hold
 *     `.tsx` font size, leading and spacing, and CSS font faces and radii.
 *   - `tokens.test.ts` holds `tokens.css` and `unity.css`.
 *
 * What none of them reads, and this does: every stylesheet (colour literals and
 * colour functions, `z-index`, `box-shadow`, durations and easings, spacing,
 * font size and line height) and colour *functions* (`rgb()`, `hsl()`, `oklch()`)
 * in `.tsx`. Each is counted per file on a ledger (`rawbudget.ts`) that may
 * shrink and may not grow — the shape `budget.ts` has, for the reason its
 * header gives.
 *
 * Not counted, by construction rather than by exemption:
 *
 *   - A custom-property *definition* (`--app-bg: #090a0e;`). That is the token
 *     being decided, which is what `look.ts`, the first `:root` block of
 *     `app.css`, `industry.css` and `tokens.css` are for. A raw value *used* by
 *     a feature rule is what drifts.
 *   - Test files, which are fixtures.
 *   - Anything outside `src/`, so `design-tokens/semester.tokens.json` and
 *     anything generated is never read.
 *
 * What it cannot see: a value assembled at runtime, a named colour such as
 * `white`, a value in a `.ts` module (the walk is `.tsx` and `.css`, like the
 * rules beside it), and a raw value inside a `var()` fallback that is also
 * counted — which is the point, not a gap.
 */

export const AXES = ['color', 'layer', 'elevation', 'radius', 'motion', 'space', 'type'] as const;
export type Axis = (typeof AXES)[number];
export type Counted = Partial<Record<Axis, number>>;
export type Ledger = Record<string, Counted>;

export interface Hit extends Problem {
  rule: Axis;
  /** The raw value itself, for a report that lists matched values. */
  value: string;
}

/**
 * Exceptions, with the reason beside each. The ledger absorbs what is already
 * there, so an entry here is a decision that a value is correct where it
 * stands — not a place to put debt.
 */
export const ALLOWED_RAW: { file: string; rule: Axis; match: RegExp; why: string }[] = [
  {
    file: 'styles/app.css',
    rule: 'motion',
    match: /\b0\.001ms\b/,
    why: 'The reduced-motion and Calm overrides clamp every duration to one tick, so the animation still ends and fires `animationend`. It is the zero of motion, not a duration to name.',
  },
];

export const SAYS: Record<Axis, string> = {
  color:
    'a colour written here is one colour on every ground, outside `lib/contrast.test.ts`. Use a semantic token — `--surface-*`, `--text-*`, `--border-*`, `--action-*`, `--status-*`, `--chart-*` (styles/tokens.css).',
  layer: 'a stacking number nobody named. Use a `--layer-*` step (styles/tokens.css); `styles/stacking.test.ts` explains the ladder.',
  elevation: 'a shadow the Corners and Ground settings cannot reach. Use `--elevation-raised|floating|modal` (`--lift-1..3`); a border is the first tool for hierarchy.',
  radius: 'a corner the Corners setting cannot reach. Use `--shape-control|card|surface` (`--r-sm|md|lg`), or `999px` for a pill.',
  motion:
    'a duration or curve that reduced motion and the Calm setting cannot zero. Animate through `--motion-*`, or `--duration-*` with `--ease-standard|emphasized` (styles/tokens.css).',
  space: 'a gap the Density setting cannot reach. Use `var(--sp-*)`, or `calc(Npx * var(--density, 1))`.',
  type: 'a size the Text size setting cannot reach. Use a `var(--type-*)` step, or `calc(Npx * var(--text-scale, 1))`.',
};

const LAYERS: Record<string, string> = { '20': 'sticky', '21': 'chrome', '80': 'overlay', '90': 'menu', '100': 'skip', '1500': 'curtain' };
const RADII: Record<string, string> = { '3': '--r-sm', '6': '--r-md', '10': '--r-lg' };
const DURATIONS: Record<string, string> = { '130': '--duration-fast', '180': '--duration-standard', '240': '--duration-slow', '280': '--duration-sheet' };

const lineOf = (text: string, at: number) => text.slice(0, at).split('\n').length;
const rel = (path: string) => path.slice(path.lastIndexOf('/src/') + 5);

/** CSS comments only. `withoutComments` also blanks `//…`, which in a stylesheet is a URL. */
const cssWithoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

const hasDuration = (v: string) => /(?<![\w.-])\d*\.?\d+m?s\b(?!\w)/.test(v.replace(/\b0m?s\b/g, ''));

/** A value with every `var(...)` removed — a token reference is the right answer, whatever it falls back to. */
const withoutVars = (v: string) => {
  let out = v;
  for (let i = 0; i < 4; i++) out = out.replace(/var\([^()]*\)/g, '');
  return out;
};

function suggest(rule: Axis, value: string): string {
  const base = SAYS[rule];
  const num = /(\d+(?:\.\d+)?)/.exec(value)?.[1] ?? '';
  if (rule === 'layer' && LAYERS[num]) return `${num} is \`var(--layer-${LAYERS[num]})\`. ${base}`;
  if (rule === 'radius' && RADII[num]) return `${num}px is \`var(${RADII[num]})\` on the default Corners. ${base}`;
  if (rule === 'motion') {
    const ms = /(\d+(?:\.\d+)?)ms/.exec(value)?.[1] ?? (/(\d*\.?\d+)s\b/.exec(value) ? String(Number(/(\d*\.?\d+)s\b/.exec(value)![1]) * 1000) : '');
    if (DURATIONS[ms]) return `${ms}ms is \`var(${DURATIONS[ms]})\`. ${base}`;
    if (/0\.22,\s*1,\s*0\.36,\s*1/.test(value)) return `that curve is \`var(--ease-standard)\`. ${base}`;
    if (/0\.2,\s*0\.8,\s*0\.2,\s*1/.test(value)) return `that curve is \`var(--ease-emphasized)\`. ${base}`;
  }
  if (rule === 'space' && SPACE[num]) return `${num}px is \`var(--sp-${SPACE[num]})\`. ${base}`;
  if (rule === 'type' && TYPE[num]) return `${num}px is \`var(--type-${TYPE[num]})\`. ${base}`;
  if (rule === 'type' && LEADING[num] && /line-height/.test(value)) return `${num} is \`var(--leading-${LEADING[num]})\`. ${base}`;
  return base;
}

const exempt = (file: string, rule: Axis, found: string) => ALLOWED_RAW.some((a) => a.file === file && a.rule === rule && a.match.test(found));

/** `0`, `1` and `-1` order siblings inside one component; they are not part of the app's ladder. */
const localLayer = (n: string) => ['0', '1', '-1'].includes(n);

// ── CSS ──────────────────────────────────────────────────────────────────────

const COLOR_PROPS = /^(?:color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|fill|stroke|caret-color|accent-color|text-decoration-color|column-rule(?:-color)?|mask(?:-image)?)$/;
const COLOR_FN = /\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/;
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;

/** One declaration at a time: `property: value` up to the next `;`, `{` or `}`. */
const DECL = /(?<![\w-])(-{0,2}[a-z][a-z0-9-]*)\s*:\s*([^;{}]*)/g;

export function scanCss(file: string, text: string): Hit[] {
  const out: Hit[] = [];
  const code = cssWithoutComments(text);
  const push = (rule: Axis, at: number, found: string, value: string) => {
    if (exempt(file, rule, found)) return;
    out.push({ file, line: lineOf(code, at), found, rule, value, says: suggest(rule, value) });
  };

  for (const m of code.matchAll(DECL)) {
    const prop = m[1];
    // The definition of a token is the token being decided, not a feature using a raw value.
    if (prop.startsWith('--')) continue;
    // Strip `url(...)` so an SVG fragment id or data URI is not read as a colour.
    const raw = m[2].replace(/url\([^)]*\)/g, '').trim();
    const found = `${prop}: ${raw.replace(/\s+/g, ' ')}`;
    const at = m.index;

    if (COLOR_PROPS.test(prop) && (HEX.test(raw) || COLOR_FN.test(raw))) {
      push('color', at, found, (HEX.exec(raw) ?? COLOR_FN.exec(raw))![0]);
    }

    if (prop === 'z-index') {
      const n = raw.trim();
      if (/^-?\d+$/.test(n) && !localLayer(n)) push('layer', at, found, n);
    }

    if (prop === 'box-shadow' || prop === 'text-shadow') {
      const v = withoutVars(raw).trim();
      if (v !== '' && !/^(?:none|inherit|initial|unset|,|\s)*$/.test(v)) push('elevation', at, found, raw);
    }

    if (/^(?:transition|animation)(?:-duration|-delay|-timing-function)?$/.test(prop)) {
      const v = withoutVars(raw);
      if (hasDuration(v) || /cubic-bezier\(/.test(v)) push('motion', at, found, raw);
    }

    if (/^(?:padding|margin|gap|row-gap|column-gap)(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$/.test(prop)) {
      for (const px of withoutVars(raw).matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px\b/g)) {
        // 1–2px is a hairline and 0 is nothing; neither is a step on the scale.
        if (Number(px[1]) <= 2) continue;
        // `calc(Npx * var(--density, 1))` is the written-out scale and the multiplier is the point.
        if (/calc\([^)]*var\(--density/.test(raw)) continue;
        push('space', at, found, `${px[1]}px`);
        break;
      }
    }

    if (prop === 'font-size' || prop === 'line-height') {
      const v = raw.trim();
      const absolute = /^-?\d+(?:\.\d+)?px$/.test(v) || (prop === 'line-height' && /^\d*\.?\d+$/.test(v) && v !== '0');
      if (absolute && !/var\(--text-scale/.test(v)) push('type', at, found, prop === 'line-height' ? `line-height ${v}` : v);
    }
  }
  return out;
}

// ── TSX ──────────────────────────────────────────────────────────────────────

export function scanTsx(file: string, text: string): Hit[] {
  const out: Hit[] = [];
  const code = withoutComments(text);
  // A shadow's colour is part of the shadow, which `design-system-audit.mjs` counts; blank it so one value is one finding.
  const unshadowed = code.replace(/\b(?:boxShadow|textShadow):\s*(?:'[^']*'|"[^"]*"|`[^`]*`)/g, (m) => ' '.repeat(m.length));
  for (const m of unshadowed.matchAll(/\b(?:rgba?|hsla?|oklch|oklab)\(\s*[\d.][^)\n]*\)?/g)) {
    if (exempt(file, 'color', m[0])) continue;
    out.push({ file, line: lineOf(code, m.index), found: m[0], rule: 'color', value: m[0], says: suggest('color', m[0]) });
  }
  return out;
}

// ── The walk, the ledger, the comparison ─────────────────────────────────────

/** Every raw value in the tree, before the ledger is consulted. `src` is `app/src`. */
export function scan(src: string): Hit[] {
  const hits: Hit[] = [];
  for (const f of sources(src, { tests: false })) hits.push(...scanTsx(rel(f.path), f.text));
  for (const f of sheets(src)) hits.push(...scanCss(rel(f.path), f.text));
  return hits.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
}

export function ledgerOf(hits: readonly Hit[]): Ledger {
  const out: Ledger = {};
  for (const h of hits) {
    const row = (out[h.file] ??= {});
    row[h.rule] = (row[h.rule] ?? 0) + 1;
  }
  return out;
}

export function totals(ledger: Ledger): Record<Axis, number> {
  const t = Object.fromEntries(AXES.map((a) => [a, 0])) as Record<Axis, number>;
  for (const row of Object.values(ledger)) for (const a of AXES) t[a] += row[a] ?? 0;
  return t;
}

export interface Drift extends Problem {
  /** `grew` is the failure the rule exists for; `shrank` is bookkeeping with a command that fixes it. */
  kind: 'grew' | 'shrank';
  rule: Axis;
}

/** Where the tree and the ledger disagree, naming the file and — for growth — the lines. */
export function overLedger(hits: readonly Hit[], ledger: Ledger): Drift[] {
  const now = ledgerOf(hits);
  const out: Drift[] = [];
  for (const file of [...new Set([...Object.keys(now), ...Object.keys(ledger)])].sort()) {
    for (const rule of AXES) {
      const n = now[file]?.[rule] ?? 0;
      const cap = ledger[file]?.[rule] ?? 0;
      if (n === cap) continue;
      if (n > cap) {
        // The ledger holds a count, not a position, so every site of the rule in the file is a candidate; list them.
        const sites = hits.filter((h) => h.file === file && h.rule === rule);
        const first = sites[sites.length - 1];
        out.push({
          kind: 'grew',
          rule,
          file,
          line: first.line,
          found: `${rule} ${n}, and ${cap} allowed (${sites.map((s) => `:${s.line}`).join(' ')})`,
          says:
            `${n - cap} more than this file is allowed — ${first.says}\n` +
            `    Last site: ${first.found}\n` +
            '    If the value has to stay, run `npm run design-system:css -- --fix` and say why in the same diff.',
        });
      } else {
        out.push({
          kind: 'shrank',
          rule,
          file: 'styles/rawbudget.ts',
          line: 0,
          found: `${file}: ${rule} ${n}, and ${cap} allowed`,
          says: `${cap - n} fewer than the ledger says, which is the good direction.\n    Run \`npm run design-system:css -- --fix\` so the ledger cannot be spent again.`,
        });
      }
    }
  }
  return out;
}

export function renderLedger(ledger: Ledger): string {
  const rows = Object.keys(ledger)
    .sort()
    .map((file) => `  '${file}': { ${AXES.filter((a) => ledger[file][a]).map((a) => `${a}: ${ledger[file][a]}`).join(', ')} },`);
  return `import type { Ledger } from './rawvalues.ts';

/**
 * The raw design values each file still carries. Generated — do not edit.
 *
 *     npm run design-system:css -- --fix
 *
 * measures the tree and rewrites this. A list of debts: a file that is not here
 * owes nothing, which is the rule new code is held to. It may shrink and may not
 * grow, and what it does and does not count is written in \`rawvalues.ts\`.
 * Sorted by path so a branch changes only its own lines.
 */
export const RAW_BUDGET: Ledger = {
${rows.join('\n')}
};
`;
}
