import { ACCENTS, CORNERS, DENSITIES, GROUNDS, SIZES, TEXT_SPACINGS, tokensFor, type Look } from './look';
import { contrast, over } from './contrast';

/**
 * The design tokens as data, for a tool that cannot read `look.ts`.
 *
 * `tokensFor` is where every per-ground and per-setting value is decided, and
 * `styles/tokens.css` is where the semantic names are. Neither is readable by
 * Figma, a native client or a parity check. This writes both down in one JSON
 * file in the shape those tools take — a design-tokens tree in which a variable
 * with a value per mode carries them under `$extensions.semester.modes`.
 *
 * Nothing in it is chosen here. A setting's variables are *found*, by asking
 * `tokensFor` for every option of that setting and keeping the keys whose value
 * changes, so a token added to `tokensFor` appears in the export and one that
 * stops varying leaves it, with no list to keep in step. The snapshot test
 * (`tokenexport.test.ts`) fails when the committed file and the code disagree.
 *
 * What it does not model, said once so no consumer assumes it:
 *   - Settings are exported one at a time against the default look. The ground
 *     and accent interact (a hue is resolved against whether the ground is
 *     light), so `accent` values are those on the default ground; the 143
 *     ground-by-accent pairings are `lib/contrast.test.ts`'s to hold.
 *   - `prefers-contrast: more` is a second mode of every colour and is not
 *     exported; it is `tokensFor(look, true)`.
 *   - The `[data-calm]` overrides in `tokens.css` and any value a component
 *     sets inline are not tokens and are not here.
 */

export const SCHEMA = 'semester.tokens/1';

type Modes = Record<string, string>;

export interface Variable {
  $type: 'color' | 'number' | 'dimension' | 'string';
  /** The default look's value. */
  $value: string;
  $description?: string;
  $extensions: {
    semester: {
      /** `constant` when no setting changes it, else the settings it varies with. */
      varies: string[];
      /** One entry per setting in `varies`: the value in each of that setting's modes. */
      modes?: Record<string, Modes>;
      /** Stylesheet primitives: the CSS as written, and which setting multiplies the base value. */
      css?: string;
      scaledBy?: 'density' | 'textSize';
      /** Worst contrast against the ground's five surfaces, per ground, where the variable is ink. */
      minContrast?: Record<string, number>;
    };
  };
}

export interface SemanticToken {
  $type: Variable['$type'] | 'reference' | 'string';
  /** A reference `{primitive.app-panel}` when the target is exported, else the CSS text. */
  $value: string;
  $extensions: { semester: { css: string; alias?: string } };
}

export interface TokenExport {
  $schema: string;
  $description: string;
  collections: Record<string, { modes: string[]; default: string; variables: number }>;
  primitive: Record<string, Variable>;
  semantic: Record<string, SemanticToken>;
}

/** Settings that decide tokens, with the look key and the options `tokensFor` is asked about. */
const SETTINGS: Array<{ collection: string; key: keyof Look; options: string[]; default: string }> = [
  { collection: 'ground', key: 'ground', options: GROUNDS.map((g) => g.id), default: 'ink' },
  { collection: 'accent', key: 'accent', options: ACCENTS.map((a) => a.id), default: 'sterling' },
  { collection: 'density', key: 'density', options: DENSITIES.map((d) => d.id), default: 'comfortable' },
  { collection: 'textSpacing', key: 'textSpacing', options: TEXT_SPACINGS.map((t) => t.id), default: 'normal' },
  { collection: 'textSize', key: 'textSize', options: SIZES.map((s) => s.id), default: 'normal' },
  { collection: 'corners', key: 'corners', options: CORNERS.map((c) => c.id), default: 'drawn' },
];

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/i;

function typeOf(value: string): Variable['$type'] {
  if (COLOR.test(value.trim())) return 'color';
  if (/^-?\d+(\.\d+)?$/.test(value.trim())) return 'number';
  if (/^-?\d+(\.\d+)?(px|rem|em|ch|%)$/.test(value.trim())) return 'dimension';
  return 'string';
}

const sorted = <T>(o: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

const strip = (name: string) => name.replace(/^--/, '');

/** The root block of `tokens.css`, name → value, comments removed. */
export function semanticDefs(css: string): Map<string, string> {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = /:root\s*\{([\s\S]*?)\n\}/.exec(clean)?.[1] ?? '';
  return new Map([...block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

/** Ink tokens measured against the surfaces they sit on: `fg`, dim and faint over the five-step ramp. */
function inkContrast(look: Look): Record<string, number> {
  const g = GROUNDS.find((x) => x.id === look.ground) ?? GROUNDS[0];
  const out: Record<string, number> = {};
  const rungs: Array<[string, number]> = [['--app-fg', 1], ['--app-dim', g.dimAlpha], ['--app-faint', g.faintAlpha]];
  for (const [name, alpha] of rungs) {
    let worst = Infinity;
    for (const surface of g.ramp) {
      const ink = alpha === 1 ? g.fg : over(g.fg, surface, alpha);
      const c = ink ? contrast(ink, surface) : null;
      if (c !== null) worst = Math.min(worst, c);
    }
    if (Number.isFinite(worst)) out[name] = Math.round(worst * 100) / 100;
  }
  return out;
}

/** The stylesheet primitives the semantic layer points at that `tokensFor` does not write. */
const STYLESHEET_FAMILY = /^--(type|sp|leading|lift)-|^--(ease|fast)$/;

/** The first `:root` block of `app.css`: the fixed primitives, name → CSS text. */
export function stylesheetPrimitives(appCss: string): Map<string, string> {
  const clean = appCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const block = /:root\s*\{([\s\S]*?)\n\}/.exec(clean)?.[1] ?? '';
  const out = new Map<string, string>();
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (STYLESHEET_FAMILY.test(m[1])) out.set(m[1], m[2].trim());
  }
  return out;
}

export function buildTokenExport(tokensCss: string, appCss: string): TokenExport {
  const base = tokensFor({}, false);
  const primitive: Record<string, Variable> = {};
  const collections: TokenExport['collections'] = {};

  for (const s of SETTINGS) {
    const perOption = Object.fromEntries(
      s.options.map((o) => [o, tokensFor({ [s.key]: o } as Look, false)]),
    ) as Record<string, Record<string, string>>;
    const names = new Set(s.options.flatMap((o) => Object.keys(perOption[o])));
    let n = 0;
    for (const name of [...names].sort()) {
      const modes: Modes = {};
      for (const o of s.options) modes[o] = String(perOption[o][name] ?? '');
      if (new Set(Object.values(modes)).size < 2) continue; // does not vary with this setting
      const key = strip(name);
      // A variable can vary with more than one setting (the two Industry grounds
      // carry a corners opinion, so `--r-md` moves with the ground *and* corners);
      // each is recorded, so none is hidden behind whichever was asked first.
      const ext = (primitive[key] ??= {
        $type: typeOf(String(base[name])),
        $value: String(base[name]),
        $extensions: { semester: { varies: [], modes: {} } },
      }).$extensions.semester;
      ext.varies.push(s.collection);
      ext.modes![s.collection] = sorted(modes);
      if (s.collection === 'ground' && ['--app-fg', '--app-dim', '--app-faint'].includes(name)) {
        // Per-mode, not just the default's, so a ground that fails is visible in the file.
        const byMode: Record<string, number> = {};
        for (const o of s.options) {
          const c = inkContrast({ ground: o })[name];
          if (c !== undefined) byMode[o] = c;
        }
        ext.minContrast = sorted(byMode);
      }
      n += 1;
    }
    collections[s.collection] = { modes: s.options, default: s.default, variables: n };
  }

  /*
   * Two multipliers are settings the look engine applies outside `tokensFor`: the density is
   * written by it (above), but the text scale is set on the root from the browser's own font
   * size (`App.tsx`), so it is added here from the same option table the settings page uses.
   */
  primitive['text-scale'] = {
    $type: 'number',
    $value: '1',
    $description: "Further multiplied at runtime by the browser's own root font size, so the reader's setting is respected.",
    $extensions: {
      semester: {
        varies: ['textSize'],
        modes: { textSize: sorted(Object.fromEntries(SIZES.map((x) => [x.id, String(x.scale)]))) },
      },
    },
  };
  collections.textSize.variables = 1;

  // The fixed primitives in app.css: sizes and spacing are a base value times a setting's multiplier.
  let sheet = 0;
  for (const [name, css] of stylesheetPrimitives(appCss)) {
    const key = strip(name);
    if (primitive[key]) continue;
    const scaled = /^calc\(\s*(-?\d+(?:\.\d+)?)px\s*\*\s*var\(\s*--(text-scale|density)\s*,\s*1\s*\)\s*\)$/.exec(css);
    primitive[key] = {
      $type: scaled ? 'dimension' : typeOf(css),
      $value: scaled ? `${scaled[1]}px` : css,
      $extensions: {
        semester: {
          varies: ['stylesheet'],
          ...(scaled ? { scaledBy: scaled[2] === 'density' ? 'density' : 'textSize' } : {}),
          css,
        },
      },
    };
    sheet += 1;
  }
  collections.stylesheet = { modes: ['default'], default: 'default', variables: sheet };

  // Everything `tokensFor` writes that no setting varies is a constant of the look engine.
  let constants = 0;
  for (const name of Object.keys(base).sort()) {
    const key = strip(name);
    if (primitive[key]) continue;
    primitive[key] = {
      $type: typeOf(String(base[name])),
      $value: String(base[name]),
      $extensions: { semester: { varies: ['constant'] } },
    };
    constants += 1;
  }
  collections.constant = { modes: ['default'], default: 'default', variables: constants };

  const semantic: Record<string, SemanticToken> = {};
  for (const [name, value] of semanticDefs(tokensCss)) {
    const alias = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(value)?.[1];
    const target = alias ? strip(alias) : undefined;
    if (alias && target && primitive[target]) {
      semantic[strip(name)] = {
        $type: 'reference',
        $value: `{primitive.${target}}`,
        $extensions: { semester: { css: value, alias } },
      };
    } else {
      semantic[strip(name)] = {
        $type: alias ? 'reference' : typeOf(value),
        $value: alias && semanticDefs(tokensCss).has(alias) ? `{semantic.${strip(alias)}}` : value,
        $extensions: { semester: { css: value, ...(alias ? { alias } : {}) } },
      };
    }
  }

  return {
    $schema: SCHEMA,
    $description:
      'Generated by `npm run tokens:export` from lib/look.ts (tokensFor) and styles/tokens.css. Do not edit by hand; the snapshot test fails if it drifts. See the header of lib/tokenexport.ts for what is not modelled.',
    collections: sorted(collections),
    primitive: sorted(primitive),
    semantic: sorted(semantic),
  };
}

export const serialise = (x: TokenExport): string => `${JSON.stringify(x, null, 2)}\n`;
