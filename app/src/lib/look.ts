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
 * The `deep` step sets section labels and kickers — small uppercase text — and
 * six of these were under WCAG's 4.5:1 against the darker panels, Oxblood
 * worst at 3.23:1 on Graphite. They have been lightened by the smallest amount
 * that clears it. Nothing was chosen by eye: `lib/contrast.test.ts` holds all
 * hundred accent-and-ground combinations to the ratio, and the app has ten
 * grounds, so ninety-six of those pairings had never been looked at by anyone.
 *
 * Metals and stones. The look depends on the accent not being a colour — a
 * saturated one turns a drawn interface into a dashboard — so every one of
 * these is desaturated enough to sit under text without fighting it.
 */
export const ACCENTS: Accent[] = [
  { id: 'sterling', label: 'Sterling', base: '#d4d9e2', bright: '#f6f8fb', deep: '#949cab', shade: '#4c5561' },
  { id: 'brass', label: 'Brass', base: '#d8c79a', bright: '#f2e7c8', deep: '#a3936a', shade: '#6b5c34' },
  { id: 'copper', label: 'Copper', base: '#d6a98d', bright: '#f0d3c0', deep: '#b18c76', shade: '#7a4c33' },
  { id: 'jade', label: 'Jade', base: '#a8ccbd', bright: '#d3e9e0', deep: '#7a9a8d', shade: '#3d5f52' },
  { id: 'slate', label: 'Slate', base: '#aebdd0', bright: '#d8e2ee', deep: '#8894a4', shade: '#445466' },
  { id: 'pewter', label: 'Pewter', base: '#b9b9bd', bright: '#e2e2e6', deep: '#929298', shade: '#55555a' },
  { id: 'oxblood', label: 'Oxblood', base: '#c99a9a', bright: '#e8cdcd', deep: '#ab8d8c', shade: '#6f3f3f' },
  { id: 'moss', label: 'Moss', base: '#b6c39b', bright: '#dde5c9', deep: '#8d9776', shade: '#4f5a37' },
  { id: 'ink', label: 'Indigo', base: '#a9aed6', bright: '#d5d8ee', deep: '#8d91b1', shade: '#454a72' },
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
 * Nine grounds — six dark, three light.
 *
 * Ink is the original and stays the default. The rest are the ways a dark
 * screen can actually differ: how light it is, and which way the shadows lean.
 * Graphite is Ink two steps up for a bright room. Midnight leans the blue Ink
 * only hints at; Basalt leans the other way, into a warm charcoal; Oxide is
 * dark enough for an OLED to switch pixels off entirely, which is both the
 * blackest and the cheapest on battery; Forest and Wine are the two hues that
 * still read as neutral at this darkness, and are there because a whole app in
 * one of them is a different room to sit in.
 *
 * The light three are ordered the same way. Parchment is warm; Paper is the
 * cooler, plainer one; Fog is grey enough that a phone in direct sun still
 * shows the panel edges, which a white ground does not.
 *
 * Every one of them defines every token — see `tokensFor`.
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
    id: 'basalt',
    label: 'Basalt',
    blurb: 'Warm charcoal — the other way from Midnight.',
    light: false,
    ramp: ['#0b0a09', '#131211', '#1c1a18', '#252220', '#302c29'],
    fg: '#eeebe6',
    dimAlpha: 0.65,
    faintAlpha: 0.43,
  },
  {
    id: 'oxide',
    label: 'Oxide',
    blurb: 'True black. On an OLED the pixels are off, and the battery notices.',
    light: false,
    ramp: ['#000000', '#000000', '#0b0d10', '#14171c', '#1e2229'],
    fg: '#eceef2',
    dimAlpha: 0.62,
    faintAlpha: 0.4,
  },
  {
    id: 'forest',
    label: 'Forest',
    blurb: 'Very dark green. Still neutral enough to read all evening.',
    light: false,
    ramp: ['#030705', '#070d0a', '#0e1712', '#141f19', '#1d2b23'],
    fg: '#e7efe9',
    dimAlpha: 0.64,
    faintAlpha: 0.42,
  },
  {
    id: 'wine',
    label: 'Wine',
    blurb: 'Very dark red-brown. Warm without being brown.',
    light: false,
    ramp: ['#080405', '#0e090a', '#171012', '#201618', '#2c1f21'],
    fg: '#f0e9ea',
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
    faintAlpha: 0.47,
  },
  {
    id: 'paper',
    label: 'Paper',
    blurb: 'Cooler and plainer than Parchment. Nearly white.',
    light: true,
    ramp: ['#dfe2e8', '#f2f4f7', '#fbfcfd', '#ffffff', '#ffffff'],
    fg: '#15181d',
    dimAlpha: 0.68,
    faintAlpha: 0.47,
  },
  {
    id: 'fog',
    label: 'Fog',
    blurb: 'Grey enough that panel edges still show in direct sun.',
    light: true,
    ramp: ['#c9cdd4', '#dde1e7', '#e9ecf1', '#f4f6f9', '#fdfdfe'],
    fg: '#14171c',
    dimAlpha: 0.7,
    faintAlpha: 0.48,
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

/**
 * The body face, chosen separately from the heading face.
 *
 * These were one control, which meant somebody who wanted the drawing-office
 * headings had to accept Barlow for every paragraph, and somebody who found
 * Barlow hard to read had to give up the headings to escape it. They are
 * different jobs: a heading is glanced at, a paragraph is read for ten minutes.
 *
 * Atkinson Hyperlegible is here because it exists for exactly this — it was
 * designed at the Braille Institute to keep characters apart for low vision,
 * and it is the single most useful thing this list can offer somebody who is
 * struggling. It is not buried under an "accessibility" heading, because a
 * font somebody finds easier to read is just a font they prefer.
 */
export const BODYFACES = [
  {
    id: 'barlow',
    label: 'Barlow',
    blurb: 'The original. Narrow, even, and quiet at small sizes.',
    body: 'Barlow, system-ui, sans-serif',
  },
  {
    id: 'system',
    label: 'System',
    blurb: 'Whatever your device uses everywhere else. The safest choice.',
    body: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: 'hyperlegible',
    label: 'Hyperlegible',
    blurb: 'Atkinson Hyperlegible. Built to keep letters apart — try it if reading is tiring.',
    body: '"Atkinson Hyperlegible", system-ui, sans-serif',
  },
  {
    id: 'serif',
    label: 'Serif',
    blurb: 'Georgia. Longer readings feel less like a screen.',
    body: 'Georgia, "Times New Roman", serif',
  },
  {
    id: 'mono',
    label: 'Mono',
    blurb: 'Monospaced throughout. Every character the same width.',
    body: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  },
];

export function bodyfaceOf(id: string | undefined) {
  return BODYFACES.find((b) => b.id === id) ?? BODYFACES[0];
}

/**
 * How far apart the lines sit.
 *
 * Separate from text size on purpose. Making the type bigger and making it
 * airier are two different complaints — "I cannot see this" and "this is a
 * wall" — and one slider for both means neither is fixed properly.
 */
export const LINE_HEIGHTS = [
  { id: 'tight', label: 'Tight', value: 1.35, blurb: 'More on screen at once.' },
  { id: 'normal', label: 'Normal', value: 1.55, blurb: 'The default.' },
  { id: 'airy', label: 'Airy', value: 1.75, blurb: 'Easier to keep your place in a long reading.' },
  { id: 'loose', label: 'Loose', value: 1.95, blurb: 'As open as it goes.' },
];

export function lineHeightOf(id: string | undefined): number {
  return LINE_HEIGHTS.find((l) => l.id === id)?.value ?? 1.55;
}

/**
 * How wide a paragraph is allowed to get.
 *
 * Only on the long-form screens — a guide, a note, a reading. Typographers put
 * the comfortable measure at 45–75 characters and the reason is mechanical
 * rather than aesthetic: past that, the eye loses the start of the next line on
 * the return sweep. On a laptop the app's column is well past it.
 *
 * "Full" is kept because somebody with a small window and large type will hit
 * the limit before the measure matters, and a cap that makes their screen
 * narrower for no gain is a cap they want off.
 */
export const READING_WIDTHS = [
  { id: 'narrow', label: 'Narrow', ch: 52, blurb: 'About 52 characters. Book-like.' },
  { id: 'normal', label: 'Normal', ch: 66, blurb: 'About 66 characters — the usual comfortable measure.' },
  { id: 'wide', label: 'Wide', ch: 82, blurb: 'Longer lines, less scrolling.' },
  { id: 'full', label: 'Full', ch: 0, blurb: 'No limit — use the whole column.' },
];

export function readingWidthOf(id: string | undefined): number {
  const found = READING_WIDTHS.find((w) => w.id === id);
  return found ? found.ch : 66;
}

/** The shape behind a tab or list icon. Cosmetic, and asked for often. */
export const ICON_SHAPES = [
  { id: 'none', label: 'None', radius: -1, blurb: 'Just the glyph.' },
  { id: 'round', label: 'Round', radius: 50, blurb: 'A circle behind it.' },
  { id: 'squircle', label: 'Squircle', radius: 30, blurb: 'Rounded square, like an app icon.' },
  { id: 'square', label: 'Square', radius: 6, blurb: 'Barely rounded.' },
];

export function iconShapeOf(id: string | undefined) {
  return ICON_SHAPES.find((i) => i.id === id) ?? ICON_SHAPES[0];
}

/** Whether the tab bar spells its tabs out. */
export const LABELS = [
  { id: 'on', label: 'Show labels', blurb: 'Words under every icon.' },
  { id: 'off', label: 'Icons only', blurb: 'Quieter, and taller screens. Learn the icons first.' },
];

/**
 * How much the app is allowed to shout with a number.
 *
 * A badge is a claim on attention, and an app that puts one on everything has
 * made them all mean nothing. "Only what is due" is the honest middle: a count
 * you can act on today, not a tally of everything unread.
 */
export const BADGES = [
  { id: 'due', label: 'Only what is due', blurb: 'A count you can act on today.' },
  { id: 'all', label: 'Everything', blurb: 'Every list that has something in it.' },
  { id: 'none', label: 'None', blurb: 'No numbers anywhere.' },
];

/**
 * How the feed on Today is drawn.
 *
 * Three genuinely different readings of the same day, not three skins. Cards
 * separate things and are easiest to tap; rows fit roughly twice as much on a
 * screen, which matters on a heavy Tuesday; the timeline puts everything on one
 * vertical line in time order, which is the only one that shows the *gaps*.
 */
export const FEEDS = [
  { id: 'cards', label: 'Cards', blurb: 'Separated, roomy, easiest to tap.' },
  { id: 'rows', label: 'Compact rows', blurb: 'About twice as much on a screen.' },
  { id: 'timeline', label: 'Timeline', blurb: 'One line down the day. Shows the gaps as well as the work.' },
];

export function feedStyleOf(id: string | undefined): string {
  return FEEDS.find((f) => f.id === id)?.id ?? 'cards';
}

// ── Contrast, checked rather than promised ──────────────────────────────

/** Relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const channel = (i: number) => {
    const v = parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/**
 * The contrast ratio between two colours, 1 to 21.
 *
 * This exists because the accent is now a hue somebody can drag, and a hue
 * picker without a contrast readout is a way to let people make their own app
 * unreadable and then wonder why. Better to show the number as it moves.
 */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  return Math.round(ratio * 100) / 100;
}

/** What a ratio means, in words rather than a standard's number. */
export function contrastVerdict(ratio: number): { ok: boolean; label: string } {
  if (ratio >= 7) return { ok: true, label: 'Easy to read' };
  if (ratio >= 4.5) return { ok: true, label: 'Readable' };
  if (ratio >= 3) return { ok: false, label: 'Hard work at small sizes' };
  return { ok: false, label: 'Too faint to read' };
}

/** One hue at one lightness, as a hex. */
export function hueToHex(deg: number, lum: number, sat = 0.42): string {
  const h = ((deg % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * lum - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lum - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * A whole accent from one hue.
 *
 * All four shades, not just the main one. `shade` in particular is not a
 * nicety — section labels are set in it, and a pale metal at 12px on parchment
 * is a heading nobody can read. Deriving it from the same hue is what keeps a
 * dragged colour as usable as a chosen one, and `contrast()` is what proves it
 * on screen while the slider moves.
 */
export function accentFromHue(deg: number, light: boolean): Accent {
  const h = ((deg % 360) + 360) % 360;
  return {
    id: 'hue',
    label: `Hue ${Math.round(h)}°`,
    base: hueToHex(h, light ? 0.42 : 0.7),
    bright: hueToHex(h, light ? 0.55 : 0.84),
    deep: hueToHex(h, light ? 0.32 : 0.56),
    // Dark on a light ground, light on a dark one — the reverse of `base`,
    // because this is the one that has to be legible as small text.
    shade: hueToHex(h, light ? 0.28 : 0.78),
  };
}

// ── The whole thing, as tokens ───────────────────────────────────────────

export interface Look {
  accent?: string;
  textSize?: string;
  ground?: string;
  density?: string;
  corners?: string;
  /** The heading face. The body face is chosen separately — see `bodyface`. */
  typeface?: string;
  bodyface?: string;
  lineHeight?: string;
  readingWidth?: string;
  iconShape?: string;
  labels?: string;
  badges?: string;
  feed?: string;
  /**
   * A hue for the accent, 0–360, or -1 for "use the named accent".
   *
   * Kept alongside `accent` rather than replacing it: the named accents are
   * chosen colours with a ground behind them, and somebody who has picked
   * Copper should not lose it the moment they open the hue slider to look.
   */
  hue?: number;
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
  const named = accent(look.accent);
  const g = ground(look.ground);
  /*
   * A dragged hue beats the named accent, and only while it is set.
   *
   * Overlaid rather than replacing, so opening the hue slider to look at it
   * and closing it again leaves somebody's chosen Copper where it was. -1 is
   * "none set"; 0 would be red.
   */
  const a =
    typeof look.hue === 'number' && look.hue >= 0
      ? accentFromHue(look.hue, g.light)
      : named;
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
    // The accent as a fill rather than as ink — a dot, a bar, a meter.
    //
    // This used to stay the bright metal on every ground, with a comment
    // saying a fill is not read. A fill is not read and it still has to be
    // seen: on Parchment the pale metals came out at 1.26:1 against the
    // surface behind them, which is a progress meter you cannot find. WCAG
    // asks 3:1 of meaningful non-text marks for exactly this reason, and
    // `lib/contrast.test.ts` now holds all hundred combinations to it.
    '--app-accent-fill': g.light ? a.shade : a.base,

    '--app-line': `rgba(${edge}, ${g.light ? 0.16 : 0.11})`,
    '--app-line-top': g.light ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.07)',
    '--app-line-soft': `rgba(${edge}, ${g.light ? 0.09 : 0.06})`,
    '--app-track': `rgba(${edge}, ${g.light ? 0.12 : 0.09})`,

    '--r-sm': `${sm}px`,
    '--r-md': `${md}px`,
    '--r-lg': `${lg}px`,

    '--font-heading': face.heading,
    '--font-heading-weight': face.weight,
    // The body face is its own choice. It was fixed in CSS before this, which
    // meant the typeface picker changed headings only and somebody who found
    // the body text hard to read had nothing to change.
    '--font-body': bodyfaceOf(look.bodyface).body,
    '--line-height': String(lineHeightOf(look.lineHeight)),
    // Zero means no cap. Used only by the long-form screens.
    '--reading-width': readingWidthOf(look.readingWidth)
      ? `${readingWidthOf(look.readingWidth)}ch`
      : 'none',
    '--icon-radius': iconShapeOf(look.iconShape).radius < 0
      ? '0'
      : `${iconShapeOf(look.iconShape).radius}%`,
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
    bodyface: bodyfaceOf(saved?.bodyface).id,
    lineHeight: LINE_HEIGHTS.find((l) => l.id === saved?.lineHeight)?.id ?? 'normal',
    readingWidth: READING_WIDTHS.find((w) => w.id === saved?.readingWidth)?.id ?? 'normal',
    iconShape: iconShapeOf(saved?.iconShape).id,
    labels: LABELS.find((l) => l.id === saved?.labels)?.id ?? 'on',
    badges: BADGES.find((b) => b.id === saved?.badges)?.id ?? 'due',
    feed: feedStyleOf(saved?.feed),
    // -1 rather than 0, because 0 is red.
    hue: typeof saved?.hue === 'number' && saved.hue >= 0 && saved.hue <= 360 ? saved.hue : -1,
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
