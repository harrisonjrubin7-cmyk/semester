import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { LEADING, SPACE, TYPE, sheets, sources, withoutComments, type Problem } from './rules.ts';

/**
 * The raw-value audit and the Figma mapping check, as pure functions.
 *
 * `scripts/design-system.mjs` is one way in and `designsystem.test.ts` the
 * other, the arrangement `rules.ts` and `scripts/styles.mjs` already use, so a
 * rule cannot pass the suite and fail the command or the reverse. Node runs this
 * file directly, which is why it imports `./rules.ts` with its extension and
 * nothing else that is not a Node built-in.
 *
 * ## What it adds, and what it leaves alone
 *
 * The style rule (`rules.ts`, `budget.ts`) already holds TSX font sizes,
 * leading and spacing, CSS font faces and CSS radii. `hex.test.ts` holds quoted
 * hex in `.tsx`. `tokens.test.ts` holds `tokens.css` and `unity.css`. None of
 * them looks at a colour function anywhere, at a `z-index`, `box-shadow`,
 * duration or easing literal in either language, at a TSX radius, or at CSS
 * spacing and type. Those are the seven axes below, and each of them is
 * counted per file on a ledger (`rawbudget.ts`) that may shrink and may not
 * grow — the shape `budget.ts` has, for the reason its header gives.
 *
 * Not counted, by construction rather than by exemption:
 *
 *   - A custom-property *definition* (`--app-bg: #090a0e;`). That is the token
 *     being decided, which is what `look.ts`, the first `:root` block of
 *     `app.css`, `industry.css` and `tokens.css` are for. A raw value *used* by
 *     a feature rule is what drifts.
 *   - Hex in `.tsx`, which `hex.test.ts` owns on its own reasoned ledger.
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

const STR = String.raw`(?:'[^']*'|"[^"]*"|\`[^\`]*\`)`;

export function scanTsx(file: string, text: string): Hit[] {
  const out: Hit[] = [];
  const code = withoutComments(text);
  const push = (rule: Axis, at: number, found: string, value: string) => {
    if (exempt(file, rule, found)) return;
    out.push({ file, line: lineOf(code, at), found, rule, value, says: suggest(rule, value) });
  };

  // Colour functions only. A quoted hex is `hex.test.ts`'s, on a ledger with a reason per file.
  // A shadow's colour is part of the shadow, which is its own axis below; blank it so one value is one finding.
  const unshadowed = code.replace(new RegExp(String.raw`\b(?:boxShadow|textShadow):\s*${STR}`, 'g'), (m) => ' '.repeat(m.length));
  for (const m of unshadowed.matchAll(/\b(?:rgba?|hsla?|oklch|oklab)\(\s*[\d.][^)\n]*\)?/g)) push('color', m.index, m[0], m[0]);

  for (const m of code.matchAll(/\bzIndex:\s*(-?\d+)\b/g)) if (!localLayer(m[1])) push('layer', m.index, m[0], m[1]);

  for (const m of code.matchAll(new RegExp(String.raw`\b(?:boxShadow|textShadow):\s*(${STR})`, 'g'))) {
    const v = withoutVars(m[1].slice(1, -1)).replace(/\$\{[^}]*\}/g, '').trim();
    if (v !== '' && !/^(?:none|inherit|initial|unset|,|\s)*$/.test(v)) push('elevation', m.index, m[0], m[1]);
  }

  for (const m of code.matchAll(new RegExp(String.raw`\bborder(?:(?:Top|Bottom)(?:Left|Right))?Radius:\s*(?:(\d+(?:\.\d+)?)(?![\w.%])|(${STR}))`, 'g'))) {
    const nums = m[1] !== undefined ? [m[1]] : [...withoutVars(m[2]).matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px\b/g)].map((x) => x[1]);
    // 0–2px is a hairline and 999 a pill, as `sheetLiterals` allows in a stylesheet.
    const bad = nums.find((n) => Number(n) > 2 && Number(n) < 999);
    if (bad) push('radius', m.index, m[0], bad);
  }

  for (const m of code.matchAll(new RegExp(String.raw`\b(?:transition|animation)(?:Duration|Delay|TimingFunction)?:\s*(${STR}|\d+(?:\.\d+)?)`, 'g'))) {
    const v = withoutVars(m[1]).replace(/\$\{[^}]*\}/g, '');
    if (hasDuration(v) || /cubic-bezier\(/.test(v)) push('motion', m.index, m[0], m[1]);
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
            '    If the value has to stay, run `npm run design-system:audit -- --fix` and say why in the same diff.',
        });
      } else {
        out.push({
          kind: 'shrank',
          rule,
          file: 'styles/rawbudget.ts',
          line: 0,
          found: `${file}: ${rule} ${n}, and ${cap} allowed`,
          says: `${cap - n} fewer than the ledger says, which is the good direction.\n    Run \`npm run design-system:audit -- --fix\` so the ledger cannot be spent again.`,
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
  return `import type { Ledger } from './designsystem.ts';

/**
 * The raw design values each file still carries. Generated — do not edit.
 *
 *     npm run design-system:audit -- --fix
 *
 * measures the tree and rewrites this. A list of debts: a file that is not here
 * owes nothing, which is the rule new code is held to. It may shrink and may not
 * grow, and what it does and does not count is written in \`designsystem.ts\`.
 * Sorted by path so a branch changes only its own lines.
 */
export const RAW_BUDGET: Ledger = {
${rows.join('\n')}
};
`;
}

// ── Figma mapping ────────────────────────────────────────────────────────────

export const MAPPING_SCHEMA = 'semester.figma-mapping/1';

export interface VariableMapping {
  figmaCollection: string;
  figmaVariable: string;
  /** `semantic.<name>` or `primitive.<name>` in `design-tokens/semester.tokens.json`; null while unresolved. */
  tokenPath: string | null;
  /** `--<name>`, the CSS variable the token path is exported from. */
  cssVariable: string | null;
  status: 'mapped' | 'unresolved' | 'obsolete';
  notes?: string;
}

export interface ComponentMapping {
  figmaComponent: string;
  /** Repository-relative paths of the React or CSS pattern that already implements it. */
  codePattern: string[];
  variants?: Record<string, string>;
  status: 'mapped' | 'unresolved' | 'obsolete';
  notes?: string;
}

export interface MappingManifest {
  $schema: string;
  figma: { fileUrl: string | null; fileKey: string | null; lastSynced: string | null };
  /** Token paths that must be mapped. Empty until a real Figma library exists. */
  requiredTokens: string[];
  variables: VariableMapping[];
  components: ComponentMapping[];
}

export interface TokenFile {
  primitive: Record<string, unknown>;
  semantic: Record<string, unknown>;
}

export interface MappingFinding {
  severity: 'blocker' | 'major' | 'minor';
  where: string;
  what: string;
}

export interface MappingResult {
  valid: string[];
  missingCodeToken: string[];
  obsolete: string[];
  unresolvedInFigma: string[];
  /** Semantic tokens no mapping names — candidates, not requirements. */
  unmappedCandidates: number;
  components: { valid: string[]; missingPattern: string[]; unresolved: string[]; obsolete: string[] };
  findings: MappingFinding[];
}

const STATUSES = ['mapped', 'unresolved', 'obsolete'];
const PATH = /^(primitive|semantic)\.([a-z0-9-]+)$/;

export function resolves(tokens: TokenFile, path: string): boolean {
  const m = PATH.exec(path);
  return !!m && Object.prototype.hasOwnProperty.call(tokens[m[1] as 'primitive' | 'semantic'] ?? {}, m[2]);
}

/**
 * The manifest, held to the generated export and to the tree.
 *
 * `exists` is injected so a test can feed it a made-up tree. The export is read,
 * never rebuilt: the file is `tokenexport.test.ts`'s to keep honest, and a
 * second reading of `tokens.css` here would be a second token source.
 */
export function validateMapping(manifest: unknown, tokens: TokenFile, exists: (repoPath: string) => boolean): MappingResult {
  const res: MappingResult = {
    valid: [], missingCodeToken: [], obsolete: [], unresolvedInFigma: [], unmappedCandidates: 0,
    components: { valid: [], missingPattern: [], unresolved: [], obsolete: [] }, findings: [],
  };
  const add = (severity: MappingFinding['severity'], where: string, what: string) => res.findings.push({ severity, where, what });
  const m = manifest as Partial<MappingManifest> | null;

  if (!m || typeof m !== 'object' || m.$schema !== MAPPING_SCHEMA || !Array.isArray(m.variables) || !Array.isArray(m.components) || !Array.isArray(m.requiredTokens)) {
    add('blocker', 'manifest', `not a ${MAPPING_SCHEMA} document: it needs $schema, requiredTokens, variables and components`);
    return res;
  }

  const named = new Set<string>();
  for (const [i, v] of m.variables.entries()) {
    const where = `variables[${i}] ${v?.figmaCollection ?? '?'} / ${v?.figmaVariable ?? '?'}`;
    if (!v || typeof v.figmaCollection !== 'string' || typeof v.figmaVariable !== 'string' || !STATUSES.includes(v.status)) {
      add('blocker', where, 'needs figmaCollection, figmaVariable and a status of mapped, unresolved or obsolete');
      continue;
    }
    if (v.status === 'unresolved') { res.unresolvedInFigma.push(where); continue; }
    if (typeof v.tokenPath !== 'string' || !PATH.test(v.tokenPath)) {
      add('blocker', where, `tokenPath must be primitive.<name> or semantic.<name>, got ${JSON.stringify(v.tokenPath)}`);
      continue;
    }
    const found = resolves(tokens, v.tokenPath);
    if (v.status === 'obsolete') {
      if (found) add('minor', where, `marked obsolete but ${v.tokenPath} still exists in the export; mark it mapped or remove it`);
      else res.obsolete.push(where);
      continue;
    }
    if (!found) {
      res.missingCodeToken.push(`${where} → ${v.tokenPath}`);
      add('blocker', where, `${v.tokenPath} is not in design-tokens/semester.tokens.json; a Figma variable cannot map to a token that does not exist. Add it to styles/tokens.css and run \`npm run tokens:export\`, or mark this mapping obsolete`);
      continue;
    }
    if (v.cssVariable !== `--${v.tokenPath.split('.')[1]}`) {
      add('blocker', where, `cssVariable ${JSON.stringify(v.cssVariable)} is not the variable ${v.tokenPath} is exported from (--${v.tokenPath.split('.')[1]})`);
      continue;
    }
    named.add(v.tokenPath);
    res.valid.push(`${where} → ${v.tokenPath}`);
  }

  for (const path of m.requiredTokens) {
    if (!resolves(tokens, path)) add('blocker', `requiredTokens ${path}`, 'is not in the export');
    else if (!named.has(path)) add('major', `requiredTokens ${path}`, 'is required but no mapping names it');
  }

  for (const [i, c] of m.components.entries()) {
    const where = `components[${i}] ${c?.figmaComponent ?? '?'}`;
    if (!c || typeof c.figmaComponent !== 'string' || !STATUSES.includes(c.status) || !Array.isArray(c.codePattern)) {
      add('blocker', where, 'needs figmaComponent, codePattern and a status of mapped, unresolved or obsolete');
      continue;
    }
    if (c.status === 'unresolved') { res.components.unresolved.push(where); continue; }
    if (c.status === 'obsolete') { res.components.obsolete.push(where); continue; }
    const gone = c.codePattern.filter((p) => typeof p !== 'string' || !exists(p));
    if (c.codePattern.length === 0 || gone.length) {
      res.components.missingPattern.push(`${where} → ${gone.join(', ') || '(none given)'}`);
      add('blocker', where, `a mapped component needs an existing code pattern; ${gone.join(', ') || 'codePattern is empty'} not found. Map it to the component or stylesheet that already implements it`);
      continue;
    }
    res.components.valid.push(`${where} → ${c.codePattern.join(', ')}`);
  }

  res.unmappedCandidates = Object.keys(tokens.semantic).filter((k) => !named.has(`semantic.${k}`)).length;
  return res;
}

/** `exists` for the real tree: repository-relative paths, never outside the repository. */
export const existsIn = (root: string) => (p: string) => !p.startsWith('/') && !p.includes('..') && existsSync(join(root, p));

// ── The report ───────────────────────────────────────────────────────────────

export interface ContractRun {
  /** Repository-relative test file. */
  file: string;
  passed: number;
  failed: number;
}

export interface ReportInput {
  tokenExport: { ok: boolean; passed: number; failed: number; failures: string[] };
  contracts: ContractRun[];
  hits: Hit[];
  ledger: Ledger;
  mapping: MappingResult;
}

export interface Finding {
  severity: 'blocker' | 'major' | 'minor';
  area: string;
  where: string;
  what: string;
}

/** Everything that fails the gate, ranked. Carried (ledgered) debt is a count in the report, not a finding. */
export function findings(i: ReportInput): Finding[] {
  const out: Finding[] = [];
  if (!i.tokenExport.ok) {
    out.push({ severity: 'blocker', area: 'token export', where: 'design-tokens/semester.tokens.json', what: `the committed export differs from tokens.css/look.ts (${i.tokenExport.failures.join('; ') || 'a test failed'}). Run \`npm run tokens:export\`; never edit the file` });
  }
  for (const c of i.contracts.filter((x) => x.failed > 0)) out.push({ severity: 'blocker', area: 'contract test', where: c.file, what: `${c.failed} failing` });
  for (const d of overLedger(i.hits, i.ledger)) {
    out.push({ severity: d.kind === 'grew' ? 'major' : 'minor', area: `raw value · ${d.rule}`, where: `${d.file}${d.line ? `:${d.line}` : ''}`, what: d.found });
  }
  for (const f of i.mapping.findings) out.push({ severity: f.severity, area: 'figma mapping', where: f.where, what: f.what });
  const rank = { blocker: 0, major: 1, minor: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity] || (a.where < b.where ? -1 : a.where > b.where ? 1 : 0));
}

/** A Markdown table cell. Backslash first: escaping only the pipe lets `\\|` close the escape and split the cell. */
export const escapeCell = (c: string) => c.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** Markdown with no clock, no commit and no path outside the repository, so the same tree gives the same bytes. */
export function renderReport(i: ReportInput): string {
  const all = findings(i);
  const count = (s: Finding['severity']) => all.filter((f) => f.severity === s).length;
  const t = totals(ledgerOf(i.hits));
  const files = Object.keys(ledgerOf(i.hits)).length;
  const m = i.mapping;
  const tbl = (head: string[], rows: string[][]) =>
    [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map((c) => escapeCell(c)).join(' | ')} |`)].join('\n');
  const verdict = count('blocker') + count('major') === 0 ? 'PASS' : 'FAIL';

  return [
    '# Semester design-system report',
    '',
    `Generated by \`npm run design-system:report\`. Do not edit. **${verdict}** — ${count('blocker')} blocker, ${count('major')} major, ${count('minor')} minor.`,
    '',
    '## Summary',
    '',
    tbl(['Check', 'Result'], [
      ['Token export (`semester.tokens.json` against `tokens.css` and `look.ts`)', i.tokenExport.ok ? `in step (${i.tokenExport.passed} tests)` : `DRIFT (${i.tokenExport.failed} failing)`],
      ['Style and accessibility contract tests', `${i.contracts.filter((c) => c.failed === 0).length} of ${i.contracts.length} files pass`],
      ['Raw values carried on the ledger', `${Object.values(t).reduce((a, b) => a + b, 0)} in ${files} files`],
      ['Raw values beyond the ledger', String(overLedger(i.hits, i.ledger).filter((d) => d.kind === 'grew').length)],
      ['Figma mapping', `${m.valid.length} variables valid, ${m.missingCodeToken.length} missing a code token, ${m.obsolete.length} obsolete`],
    ]),
    '',
    '## Findings',
    '',
    all.length ? tbl(['Severity', 'Area', 'Where', 'What'], all.map((f) => [f.severity, f.area, f.where, f.what])) : 'None.',
    '',
    '## Raw values carried (ledger)',
    '',
    'What is already in the tree, counted per axis. New code is held to zero; see `src/styles/designsystem.ts` for what each axis reads and what it leaves to `hex.test.ts`, `rules.ts` and `tokens.test.ts`.',
    '',
    tbl(['Axis', 'Count'], AXES.map((a) => [a, String(t[a])])),
    '',
    '## Token export',
    '',
    i.tokenExport.ok ? 'The committed file is what `buildTokenExport` produces from the current sources.' : i.tokenExport.failures.map((f) => `- ${f}`).join('\n'),
    '',
    '## Contract tests',
    '',
    tbl(['File', 'Passed', 'Failed'], [...i.contracts].sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0)).map((c) => [`\`${c.file}\``, String(c.passed), String(c.failed)])),
    '',
    '## Figma mapping',
    '',
    tbl(['Bucket', 'Count'], [
      ['Valid variable mappings', String(m.valid.length)],
      ['Mapped to a code token that does not exist', String(m.missingCodeToken.length)],
      ['Obsolete', String(m.obsolete.length)],
      ['Unresolved in Figma (no code token yet)', String(m.unresolvedInFigma.length)],
      ['Semantic tokens with no Figma mapping (candidates, not required)', String(m.unmappedCandidates)],
      ['Valid component mappings', String(m.components.valid.length)],
      ['Components mapped to a pattern that does not exist', String(m.components.missingPattern.length)],
      ['Components unresolved', String(m.components.unresolved.length)],
    ]),
    '',
    m.valid.length || m.components.valid.length ? '' : 'No Figma file has been connected, so the manifest is the empty template and nothing is mapped yet. See `docs/design-system/FIGMA-MAPPING.md`.',
    '',
  ].join('\n');
}
