/**
 * How the app looks, as data.
 *
 * The palette began as one opinion — sterling on near-black — and the accent
 * and the text size were the only two parts of it anybody could disagree with.
 * This is the rest: the ground it all sits on, how tight the spacing is, how
 * square the corners are, and what the headings are set in.
 *
 * ## Why it is a token set and not a stylesheet per theme
 *
 * Everything here resolves to CSS custom properties written onto the root
 * element by `App.tsx`. There is exactly one stylesheet, and it never learns
 * that themes exist — a rule written against `--app-panel` is right in every
 * ground, forever, including grounds added after it was written. The
 * alternative, a `.theme-light` class with its own cascade, means every new
 * rule is a chance to forget one theme, and the forgetting shows up as white
 * text on white six screens away from where it was introduced.
 *
 * ## The one hard rule
 *
 * Every ground defines every token. Not "the dark ones plus overrides" — all
 * of them, every time. A ground that inherits half its values from whatever
 * was set last is a ground that looks different depending on which theme you
 * were using before, which is the kind of bug nobody can reproduce.
 * `tokensFor` returns a complete set and `look.test.ts` checks that the sets
 * all have the same keys.
 */

export interface Accent {
  id: string;
  label: string;
  /** The accent itself. */
  base: string;
  /** A lighter one for hover and emphasis. */
  bright: string;
  /** A darker one for secondary marks. */
  deep: string;
  /**
   * The same metal, dark enough to be read as text on a light ground.
   *
   * Not a nicety. Section labels and kickers are set in `--app-accent-deep`,
   * and a pale metal at 12px on parchment is a heading you cannot read — which
   * is exactly the failure a light theme ships with when it is built by
   * swapping the background and calling it done.
   */
  shade: string;
}

/**
 * The accents the app will wear.
 *
 * Metals and stones. The look depends on the accent not being a colour — a
 * saturated one turns a drawn interface into a dashboard — so every one of
 * these is desaturated enough to sit under text without fighting it.
 */
export const ACCENTS: Accent[] = [
  { id: 'sterling', label: 'Sterling', base: '#d4d9e2', bright: '#f6f8fb', deep: '#949cab', shade: '#4c5561' },
  { id: 'brass', label: 'Brass', base: '#d8c79a', bright: '#f2e7c8', deep: '#a3936a', shade: '#6b5c34' },
  { id: 'copper', label: 'Copper', base: '#d6a98d', bright: '#f0d3c0', deep: '#a67c63', shade: '#7a4c33' },
  { id: 'jade', label: 'Jade', base: '#a8ccbd', bright: '#d3e9e0', deep: '#7a9a8d', shade: '#3d5f52' },
  { id: 'slate', label: 'Slate', base: '#aebdd0', bright: '#d8e2ee', deep: '#7f8c9d', shade: '#445466' },
  { id: 'pewter', label: 'Pewter', base: '#b9b9bd', bright: '#e2e2e6', deep: '#85858b', shade: '#55555a' },
  { id: 'oxblood', label: 'Oxblood', base: '#c99a9a', bright: '#e8cdcd', deep: '#96706f', shade: '#6f3f3f' },
  { id: 'moss', label: 'Moss', base: '#b6c39b', bright: '#dde5c9', deep: '#87926f', shade: '#4f5a37' },
  { id: 'ink', label: 'Indigo', base: '#a9aed6', bright: '#d5d8ee', deep: '#7c81a5', shade: '#454a72' },
  { id: 'gold', label: 'Old gold', base: '#d6c089', bright: '#efe1bc', deep: '#a3906a', shade: '#695a2f' },
];

export function accent(id: string | undefined): Accent {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}

/** Text scale, for a phone held at arm's length or a small screen. */
export const SIZES = [
  { id: 'compact', label: 'Compact', scale: 0.94 },
  { id: 'normal', label: 'Normal', scale: 1 },
  { id: 'large', label: 'Large', scale: 1.09 },
  { id: 'largest', label: 'Largest', scale: 1.18 },
];

export function scaleOf(id: string | undefined): number {
  return SIZES.find((s) => s.id === id)?.scale ?? 1;
}

// ── The ground ───────────────────────────────────────────────────────────

export interface Ground {
  id: string;
  label: string;
  blurb: string;
  /** True when text is dark on light, which several other choices key off. */
  light: boolean;
  /** Five steps of surface, void first. */
  ramp: [string, string, string, string, string];
  /** Text, at three strengths of presence. */
  fg: string;
  dimAlpha: number;
  faintAlpha: number;
}

/**
 * Four grounds.
 *
 * Ink is the original and stays the default. Graphite is the same idea two
 * steps lighter, for a screen that is not an OLED phone in a dark room.
 * Midnight leans the blue that Ink only hints at. Parchment is the light one,
 * and it is warm rather than white — a pure white ground under a desaturated
 * metal accent looks like an unstyled page, and the small amount of warmth is
 * what keeps the accents reading as metal rather than as grey.
 */
export const GROUNDS: Ground[] = [
  {
    id: 'ink',
    label: 'Ink',
    blurb: 'Near-black, cooled slightly. The original.',
    light: false,
    ramp: ['#040507', '#090a0e', '#12141a', '#191c23', '#22262f'],
    fg: '#eceef2',
    dimAlpha: 0.64,
    faintAlpha: 0.42,
  },
  {
    id: 'graphite',
    label: 'Graphite',
    blurb: 'The same, lifted — easier in a bright room.',
    light: false,
    ramp: ['#0e0f12', '#16181c', '#1f2229', '#282c34', '#333843'],
    fg: '#eceef2',
    dimAlpha: 0.66,
    faintAlpha: 0.44,
  },
  {
    id: 'midnight',
    label: 'Midnight',
    blurb: 'Blue-black, for the evening.',
    light: false,
    ramp: ['#04060d', '#080b15', '#101524', '#171d31', '#212942'],
    fg: '#e8ecf4',
    dimAlpha: 0.64,
    faintAlpha: 0.42,
  },
  {
    id: 'parchment',
    label: 'Parchment',
    blurb: 'Dark on warm light, for daylight and for printing.',
    light: true,
    ramp: ['#e8e4dc', '#f4f1ea', '#fbf9f4', '#ffffff', '#ffffff'],
    fg: '#1b1a17',
    dimAlpha: 0.68,
    faintAlpha: 0.46,
  },
];

export function ground(id: string | undefined): Ground {
  return GROUNDS.find((g) => g.id === id) ?? GROUNDS[0];
}

// ── Spacing, corners, type ───────────────────────────────────────────────

export const DENSITIES = [
  { id: 'comfortable', label: 'Comfortable', scale: 1 },
  { id: 'snug', label: 'Snug', scale: 0.86 },
  { id: 'tight', label: 'Tight', scale: 0.74 },
];

export function densityOf(id: string | undefined): number {
  return DENSITIES.find((d) => d.id === id)?.scale ?? 1;
}

export const CORNERS = [
  { id: 'drawn', label: 'Drawn', radii: [3, 6, 10] },
  { id: 'square', label: 'Square', radii: [0, 0, 0] },
  { id: 'soft', label: 'Soft', radii: [6, 12, 18] },
  { id: 'round', label: 'Round', radii: [10, 18, 28] },
];

export function cornersOf(id: string | undefined): number[] {
  return CORNERS.find((c) => c.id === id)?.radii ?? CORNERS[0].radii;
}

/**
 * What headings are set in.
 *
 * Every stack ends in a system font, so a face that fails to load degrades to
 * something with the same proportions rather than to Times New Roman. Only the
 * first two are loaded by the app; the rest are asking for faces the device
 * already has, which is why they cost nothing.
 */
export const TYPEFACES = [
  {
    id: 'condensed',
    label: 'Condensed',
    blurb: 'Barlow Condensed. The original — drawing-office lettering.',
    heading: '"Barlow Condensed", system-ui, sans-serif',
    weight: '600',
  },
  {
    id: 'grotesk',
    label: 'Grotesk',
    blurb: 'Plainer and wider. Easier at small sizes.',
    heading: 'Barlow, system-ui, sans-serif',
    weight: '600',
  },
  {
    id: 'system',
    label: 'System',
    blurb: 'Whatever your device uses everywhere else.',
    heading: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    weight: '600',
  },
  {
    id: 'serif',
    label: 'Serif',
    blurb: 'Headings with serifs. Reads like a document.',
    heading: 'Georgia, "Times New Roman", serif',
    weight: '600',
  },
  {
    id: 'mono',
    label: 'Mono',
    blurb: 'Monospaced headings. Technical, and unmistakably deliberate.',
    heading: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    weight: '600',
  },
];

export function typefaceOf(id: string | undefined) {
  return TYPEFACES.find((t) => t.id === id) ?? TYPEFACES[0];
}

// ── The whole thing, as tokens ───────────────────────────────────────────

export interface Look {
  accent?: string;
  textSize?: string;
  ground?: string;
  density?: string;
  corners?: string;
  typeface?: string;
}

/** `rgba()` from a hex and an alpha, so one ink colour makes three strengths. */
export function fade(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Every custom property the look decides, as one flat map.
 *
 * Written whole on every change rather than diffed, which is what makes a
 * ground switch atomic: no frame where the new panel colour has landed and the
 * new text colour has not.
 */
export function tokensFor(look: Look): Record<string, string> {
  const a = accent(look.accent);
  const g = ground(look.ground);
  const [void_, bg, panel, hero, raise] = g.ramp;
  const [sm, md, lg] = cornersOf(look.corners);
  const face = typefaceOf(look.typeface);
  const d = densityOf(look.density);

  // On a light ground the hairlines have to be dark or they vanish, and the
  // washes have to be stronger to be visible at all. Same tokens, opposite ink.
  const edge = g.light ? '17, 17, 17' : '236, 238, 242';

  return {
    '--app-void': void_,
    '--app-bg': bg,
    '--app-panel': panel,
    '--app-hero': hero,
    '--app-raise': raise,

    '--app-fg': g.fg,
    '--app-dim': fade(g.fg, g.dimAlpha),
    '--app-faint': fade(g.fg, g.faintAlpha),

    // On a light ground the accent has to darken to stay legible as text —
    // the same metal, three steps down — and the wash has to be mixed from
    // that darker shade or it is a selection state you cannot see.
    '--app-accent': g.light ? a.shade : a.base,
    '--app-accent-bright': g.light ? a.shade : a.bright,
    '--app-accent-deep': g.light ? a.shade : a.deep,
    '--app-accent-wash': g.light ? fade(a.shade, 0.1) : fade(a.base, 0.12),
    // The accent as a fill rather than as ink — a dot, a bar, a meter. Stays
    // the bright metal on every ground, because a fill is not read.
    '--app-accent-fill': a.base,

    '--app-line': `rgba(${edge}, ${g.light ? 0.16 : 0.11})`,
    '--app-line-top': g.light ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.07)',
    '--app-line-soft': `rgba(${edge}, ${g.light ? 0.09 : 0.06})`,
    '--app-track': `rgba(${edge}, ${g.light ? 0.12 : 0.09})`,

    '--r-sm': `${sm}px`,
    '--r-md': `${md}px`,
    '--r-lg': `${lg}px`,

    '--font-heading': face.heading,
    '--font-heading-weight': face.weight,
    '--density': String(d),

    // The brushed-metal gradient is the one token that cannot simply be
    // recoloured: on a light ground a white-to-transparent sweep is invisible.
    // Inverted rather than dropped, so display type keeps its lustre.
    // Text sitting ON the brushed metal — the primary button, an active chip.
    // It has to invert with the sweep or it is dark on dark.
    '--chrome-ink': g.light ? '#f7f5f0' : '#08090c',
    '--chrome-glint': g.light ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.35)',

    '--chrome': g.light
      ? 'linear-gradient(172deg, rgba(0,0,0,.86), rgba(0,0,0,.62) 46%, rgba(0,0,0,.5) 52%, rgba(0,0,0,.78) 65%, rgba(0,0,0,.88))'
      : 'linear-gradient(172deg, #f7f8fa, #c9ced8 46%, #aeb4c0 52%, #dfe3ea 65%, #f4f6f9)',
  };
}

/**
 * What a saved look is, made safe to render from.
 *
 * Anything unrecognised falls back to the default rather than being written
 * through — a stored theme from a future version reaching an older build
 * should look plain, not broken.
 */
export function readLook(saved: Look | undefined): Required<Look> {
  return {
    accent: accent(saved?.accent).id,
    textSize: SIZES.find((s) => s.id === saved?.textSize)?.id ?? 'normal',
    ground: ground(saved?.ground).id,
    density: DENSITIES.find((d) => d.id === saved?.density)?.id ?? 'comfortable',
    corners: CORNERS.find((c) => c.id === saved?.corners)?.id ?? 'drawn',
    typeface: typefaceOf(saved?.typeface).id,
  };
}

/** How the current look reads in one line, for a settings row. */
export function lookLine(look: Look): string {
  const parts = [accent(look.accent).label, ground(look.ground).label];
  const face = typefaceOf(look.typeface);
  if (face.id !== TYPEFACES[0].id) parts.push(face.label);
  const corners = CORNERS.find((c) => c.id === look.corners);
  if (corners && corners.id !== CORNERS[0].id) parts.push(corners.label);
  return parts.join(' · ');
}
